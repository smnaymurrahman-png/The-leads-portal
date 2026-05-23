import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, TxnStatus, TxnType } from '@prisma/client';
import {
  ORDER_PAID,
  ORDER_PAYMENT_FAILED,
  type OrderPaidEvent,
  type OrderPaymentFailedEvent,
} from '../events/order-events';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueService } from '../revenue/revenue.service';
import { StripeService } from '../stripe/stripe.service';

/** The Stripe `Event` type, derived from the SDK's `constructEvent` return. */
type StripeEvent = ReturnType<StripeService['client']['webhooks']['constructEvent']>;

/** The few Stripe invoice fields the payment handlers actually use. */
interface StripeInvoice {
  id: string;
  invoice_pdf: string | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly events: EventEmitter2,
    private readonly revenue: RevenueService,
  ) {}

  /**
   * Verifies the Stripe webhook signature and applies the payment outcome to
   * the matching order. Unknown events are acknowledged and ignored.
   */
  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    let event: StripeEvent;
    try {
      event = this.stripe.client.webhooks.constructEvent(
        rawBody,
        signature ?? '',
        this.stripe.webhookSecret,
      );
    } catch (error) {
      throw new BadRequestException(
        `Invalid Stripe webhook signature: ${(error as Error).message}`,
      );
    }

    const invoice = event.data.object as unknown as StripeInvoice;
    switch (event.type) {
      case 'invoice.paid':
        await this.markPaid(invoice);
        break;
      case 'invoice.payment_failed':
      case 'invoice.voided':
        await this.markFailed(invoice, event.type);
        break;
      default:
        this.logger.log(`Ignoring Stripe event: ${event.type}`);
    }
    return { received: true };
  }

  /** Successful payment → order PAID then ACTIVE, with an invoice + transaction. */
  private async markPaid(invoice: StripeInvoice): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { stripe_invoice_id: invoice.id },
      include: { client: { select: { agent_id: true } } },
    });
    if (!order) {
      this.logger.warn(`Paid invoice ${invoice.id} matched no order`);
      return;
    }
    // Idempotent — Stripe retries webhooks; a paid order is left untouched.
    if (order.status === OrderStatus.ACTIVE || order.status === OrderStatus.PAID) {
      return;
    }

    const invoiceNumber = `INV-${new Date().getFullYear()}-${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
    // A commission is booked per paid order at the configured agent rate.
    const commissionRate = await this.revenue.getCommissionRate();
    const commissionAmount = Number((Number(order.total_amount) * commissionRate).toFixed(2));

    await this.prisma.$transaction([
      // PAID → ACTIVE: the order is now live, with its full paid balance.
      this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ACTIVE,
          paid_at: new Date(),
          quantity_remaining: order.quantity_paid,
        },
      }),
      this.prisma.invoice.create({
        data: {
          order_id: order.id,
          client_id: order.client_id,
          invoice_number: invoiceNumber,
          amount: order.total_amount,
          issued_at: new Date(),
          pdf_url: invoice.invoice_pdf ?? null,
        },
      }),
      this.prisma.transaction.create({
        data: {
          order_id: order.id,
          client_id: order.client_id,
          stripe_payment_id: invoice.id,
          amount: order.total_amount,
          type: TxnType.CHARGE,
          status: TxnStatus.SUCCEEDED,
        },
      }),
      this.prisma.commission.create({
        data: {
          agent_id: order.client.agent_id,
          order_id: order.id,
          amount: commissionAmount,
          rate: commissionRate,
        },
      }),
    ]);

    const payload: OrderPaidEvent = {
      orderId: order.id,
      publicOrderId: order.public_order_id,
      clientId: order.client_id,
    };
    this.events.emit(ORDER_PAID, payload);
    this.logger.log(`Order ${order.public_order_id} paid → ACTIVE (invoice ${invoiceNumber})`);
  }

  /** Failed / voided payment → order PAYMENT_FAILED. Stays inactive (no leads). */
  private async markFailed(invoice: StripeInvoice, eventType: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { stripe_invoice_id: invoice.id },
    });
    if (!order) {
      return;
    }
    // A late failure/void on an already-paid order is ignored.
    if (order.status === OrderStatus.ACTIVE || order.status === OrderStatus.PAID) {
      return;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAYMENT_FAILED },
    });

    const payload: OrderPaymentFailedEvent = {
      orderId: order.id,
      publicOrderId: order.public_order_id,
      clientId: order.client_id,
    };
    this.events.emit(ORDER_PAYMENT_FAILED, payload);
    this.logger.warn(`Order ${order.public_order_id}: ${eventType} → PAYMENT_FAILED`);
  }
}
