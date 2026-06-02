import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Client, type Order, OrderStatus, Prisma, TxnStatus, TxnType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OwnershipService } from '../auth/ownership.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { StripeService } from '../stripe/stripe.service';
import type { CreateOrderDto } from './dto/create-order.dto';

/** Client fields safe to embed in an order response. */
const CLIENT_SUMMARY = {
  select: { id: true, full_name: true, business_name: true, email: true },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly pricing: PricingService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
  ) {}

  /** CLIENT places an order request. total_amount = quantity × unit_price. */
  async create(actor: AuthPrincipal, dto: CreateOrderDto) {
    const prices = await this.pricing.list();
    const price = prices.find(
      (p) => p.lead_type === dto.lead_type && p.delivery_mode === dto.delivery_mode,
    );
    if (!price) {
      throw new BadRequestException(
        `No price configured for ${dto.lead_type} / ${dto.delivery_mode}`,
      );
    }

    const unitPrice = price.unit_price;
    const total = unitPrice * dto.quantity;

    return this.prisma.order.create({
      data: {
        public_order_id: `ORD-${randomBytes(5).toString('hex').toUpperCase()}`,
        client_id: actor.id,
        lead_type: dto.lead_type,
        delivery_mode: dto.delivery_mode,
        criteria: dto.criteria as Prisma.InputJsonValue,
        quantity_paid: dto.quantity,
        quantity_remaining: 0, // becomes quantity_paid once the order is paid
        unit_price: unitPrice,
        total_amount: total,
        status: OrderStatus.REQUESTED,
        requirements: dto.requirements,
        needed_by: dto.needed_by ? new Date(dto.needed_by) : null,
        requested_at: new Date(),
      },
      include: { client: CLIENT_SUMMARY },
    });
  }

  /** Scoped list: CLIENT → own, AGENT → their clients', ADMIN/SUPER → all. */
  list(actor: AuthPrincipal) {
    return this.prisma.order.findMany({
      where: this.ownership.orderScope(actor),
      include: { client: CLIENT_SUMMARY },
      orderBy: { created_at: 'desc' },
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    await this.ownership.assertCanAccessOrder(actor, id);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { client: CLIENT_SUMMARY },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /**
   * ADMIN/SUPER_ADMIN accepts a REQUESTED order: a Stripe invoice is created
   * and finalised, and the order moves to INVOICED with the payment link.
   */
  async accept(actor: AuthPrincipal, id: string) {
    const order = await this.requireOrder(id);
    if (order.status !== OrderStatus.REQUESTED) {
      throw new ConflictException(`Order cannot be accepted from status ${order.status}`);
    }
    const { invoiceId, paymentLink } = await this.createStripeInvoice(order, order.client);
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.INVOICED,
        approved_by: actor.id,
        stripe_invoice_id: invoiceId,
        stripe_payment_link: paymentLink,
      },
      include: { client: CLIENT_SUMMARY },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_APPROVE',
      entity: 'order',
      entityId: id,
      after: { status: updated.status, stripeInvoiceId: invoiceId },
    });
    return updated;
  }

  /** ADMIN/SUPER_ADMIN rejects a REQUESTED order. No charge is created. */
  async reject(actor: AuthPrincipal, id: string, note: string) {
    const order = await this.requireOrder(id);
    if (order.status !== OrderStatus.REQUESTED) {
      throw new ConflictException(`Order cannot be rejected from status ${order.status}`);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.REJECTED, reject_note: note, approved_by: actor.id },
      include: { client: CLIENT_SUMMARY },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_REJECT',
      entity: 'order',
      entityId: id,
      after: { status: 'REJECTED', note },
    });
    return updated;
  }

  /**
   * ADMIN/SUPER_ADMIN refunds a paid order via Stripe: a REFUND transaction is
   * recorded and the order is cancelled.
   */
  async refund(actor: AuthPrincipal, id: string) {
    const order = await this.requireOrder(id);
    const paidStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.ACTIVE,
      OrderStatus.FULFILLING,
      OrderStatus.COMPLETED,
    ];
    if (!paidStatuses.includes(order.status)) {
      throw new ConflictException(`Order is ${order.status}; there is nothing to refund`);
    }
    if (!order.stripe_invoice_id) {
      throw new ConflictException('Order has no Stripe invoice to refund');
    }
    const alreadyRefunded = await this.prisma.transaction.findFirst({
      where: { order_id: id, type: TxnType.REFUND, status: TxnStatus.SUCCEEDED },
    });
    if (alreadyRefunded) {
      throw new ConflictException('Order has already been refunded');
    }

    // Resolve the payment intent behind the invoice, then refund it.
    const invoice = await this.stripe.client.invoices.retrieve(order.stripe_invoice_id);
    const paymentIntent = (invoice as { payment_intent?: string | { id: string } | null })
      .payment_intent;
    const paymentIntentId =
      typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
    if (!paymentIntentId) {
      throw new ConflictException('No completed payment found for this order');
    }
    const refund = await this.stripe.client.refunds.create({ payment_intent: paymentIntentId });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          order_id: id,
          client_id: order.client_id,
          stripe_payment_id: refund.id,
          amount: order.total_amount,
          type: TxnType.REFUND,
          status: TxnStatus.SUCCEEDED,
        },
      });
      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
        include: { client: CLIENT_SUMMARY },
      });
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: 'REFUND',
      entity: 'order',
      entityId: id,
      after: { refundId: refund.id, amount: Number(order.total_amount) },
    });
    return updated;
  }

  /**
   * Issues a fresh Stripe invoice for an order whose payment is still open
   * (INVOICED) or has failed (PAYMENT_FAILED). The previous invoice is voided.
   */
  async regeneratePaymentLink(actor: AuthPrincipal, id: string) {
    await this.ownership.assertCanAccessOrder(actor, id);
    const order = await this.requireOrder(id);
    if (order.status !== OrderStatus.INVOICED && order.status !== OrderStatus.PAYMENT_FAILED) {
      throw new ConflictException(
        `Order has no regenerable invoice (status ${order.status})`,
      );
    }
    if (order.stripe_invoice_id) {
      try {
        await this.stripe.client.invoices.voidInvoice(order.stripe_invoice_id);
      } catch {
        // Previous invoice already paid or void — safe to ignore.
      }
    }
    const { invoiceId, paymentLink } = await this.createStripeInvoice(order, order.client);
    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.INVOICED,
        stripe_invoice_id: invoiceId,
        stripe_payment_link: paymentLink,
      },
      include: { client: CLIENT_SUMMARY },
    });
  }

  private async requireOrder(id: string): Promise<Order & { client: Client }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** Creates + finalises a Stripe invoice for the order's total. */
  private async createStripeInvoice(
    order: Order,
    client: Client,
  ): Promise<{ invoiceId: string; paymentLink: string | null }> {
    const customerId = await this.ensureStripeCustomer(client);
    const stripe = this.stripe.client;

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 7,
      auto_advance: false,
      description: `Leads Portal — order ${order.public_order_id}`,
      metadata: { orderId: order.id, publicOrderId: order.public_order_id },
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: Math.round(Number(order.total_amount) * 100), // dollars → cents
      currency: 'usd',
      description: `${order.quantity_paid} × ${order.lead_type} (${order.delivery_mode}) leads`,
    });

    const finalised = await stripe.invoices.finalizeInvoice(invoice.id);
    return { invoiceId: finalised.id, paymentLink: finalised.hosted_invoice_url ?? null };
  }

  /** Returns the client's Stripe customer id, creating + persisting it once. */
  private async ensureStripeCustomer(client: Client): Promise<string> {
    if (client.stripe_customer_id) {
      return client.stripe_customer_id;
    }
    const customer = await this.stripe.client.customers.create({
      email: client.email,
      name: client.full_name,
      metadata: { clientId: client.id },
    });
    await this.prisma.client.update({
      where: { id: client.id },
      data: { stripe_customer_id: customer.id },
    });
    return customer.id;
  }
}
