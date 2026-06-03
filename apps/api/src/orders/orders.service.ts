import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type Client,
  type Order,
  OrderStatus,
  Prisma,
  Role,
  TxnStatus,
  TxnType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OwnershipService } from '../auth/ownership.service';
import type { AuthPrincipal } from '../auth/types';
import {
  ORDER_ACCEPTED,
  ORDER_CANCELLED,
  ORDER_PROOF_SUBMITTED,
  ORDER_REJECTED,
  type OrderAcceptedEvent,
  type OrderCancelledEvent,
  type OrderProofSubmittedEvent,
  type OrderRejectedEvent,
} from '../events/order-events';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { StorageService } from '../storage/storage.service';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';

/** Used everywhere we hand an order back to the client / agent / admin UI. */
const CLIENT_SUMMARY = {
  select: { id: true, full_name: true, business_name: true, email: true, agent_id: true },
} as const;

export const PAYMENT_PROOF_INTENT = 'payment_proof';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly pricing: PricingService,
    private readonly invoices: InvoicesService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Create / read ──────────────────────────────────────────────────────────

  /**
   * CLIENT places an order request. The order is born in `AWAITING_PAYMENT`
   * — visible immediately to the agent who owns this client, so they can
   * reach out via WhatsApp and collect funds off-platform.
   */
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

    const order = await this.prisma.order.create({
      data: {
        public_order_id: this.generatePublicId(),
        client_id: actor.id,
        lead_type: dto.lead_type,
        delivery_mode: dto.delivery_mode,
        criteria: dto.criteria as Prisma.InputJsonValue,
        quantity_paid: dto.quantity,
        quantity_remaining: 0, // becomes quantity_paid when the order is accepted
        unit_price: unitPrice,
        total_amount: total,
        status: OrderStatus.AWAITING_PAYMENT,
        requirements: dto.requirements,
        needed_by: dto.needed_by ? new Date(dto.needed_by) : null,
        requested_at: new Date(),
      },
      include: { client: CLIENT_SUMMARY },
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_CREATE',
      entity: 'order',
      entityId: order.id,
      after: { status: order.status, total: Number(order.total_amount) },
    });

    return order;
  }

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

  // ── Agent: upload payment proof ───────────────────────────────────────────

  /**
   * AGENT uploads the WhatsApp payment screenshot. Allowed only when:
   *   - the order belongs to a client this agent owns
   *   - the order is `AWAITING_PAYMENT`.
   * Transitions to `PROOF_SUBMITTED` and lands in the admin queue.
   */
  async uploadPaymentProof(
    actor: AuthPrincipal,
    id: string,
    file: Express.Multer.File | undefined,
    dto: UploadPaymentProofDto,
  ) {
    if (!file) {
      throw new BadRequestException('Missing screenshot file');
    }
    const order = await this.requireOrder(id);
    this.assertAgentOwnsOrder(actor, order);
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new ConflictException(
        `Cannot upload payment proof while the order is ${order.status}`,
      );
    }

    const stored = await this.storage.store({
      bucket: 'payment-proofs',
      originalFilename: file.originalname,
      mime: file.mimetype,
      buffer: file.buffer,
    });

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PROOF_SUBMITTED,
        payment_screenshot_path: stored.relativePath,
        payment_screenshot_filename: stored.filename,
        payment_screenshot_size: stored.size,
        payment_screenshot_mime: stored.mime,
        payment_screenshot_sha256: stored.sha256,
        payment_uploaded_by: actor.id,
        payment_uploaded_at: new Date(),
        payment_method: dto.payment_method,
        payment_reference: dto.payment_reference,
        payment_note: dto.payment_note,
      },
      include: { client: CLIENT_SUMMARY },
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_PAYMENT_PROOF',
      entity: 'order',
      entityId: id,
      after: {
        status: updated.status,
        sha256: stored.sha256,
        method: dto.payment_method,
      },
    });

    this.events.emit(ORDER_PROOF_SUBMITTED, {
      orderId: updated.id,
      publicOrderId: updated.public_order_id,
      clientId: updated.client_id,
      agentId: order.client.agent_id,
      uploadedBy: actor.id,
    } satisfies OrderProofSubmittedEvent);

    return updated;
  }

  /**
   * Returns a short-lived signed URL the caller can use to fetch the
   * screenshot directly (without sending the JWT — handy for `<img src>`).
   */
  async paymentProofUrl(actor: AuthPrincipal, id: string) {
    await this.ownership.assertCanAccessOrder(actor, id);
    const order = await this.requireOrder(id);
    if (!order.payment_screenshot_path) {
      throw new NotFoundException('No payment proof has been uploaded for this order');
    }
    const signed = this.storage.signResourceUrl(PAYMENT_PROOF_INTENT, id, actor.id);
    return {
      order_id: id,
      mime: order.payment_screenshot_mime,
      filename: order.payment_screenshot_filename,
      url: `/api/orders/${id}/payment-proof?token=${encodeURIComponent(signed.token)}`,
      expires_at: new Date(signed.expSeconds * 1000).toISOString(),
    };
  }

  /** Verifies a signed token and reads the file. Used by the GET handler. */
  async readPaymentProofWithToken(id: string, token: string | undefined) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || !order.payment_screenshot_path) {
      throw new NotFoundException('Order or proof not found');
    }
    const claims = this.storage.verifyResourceUrl(token, PAYMENT_PROOF_INTENT, id);
    if (!claims) {
      throw new ForbiddenException('Invalid or expired token');
    }
    const buffer = await this.storage.read(order.payment_screenshot_path);
    return {
      buffer,
      mime: order.payment_screenshot_mime ?? 'application/octet-stream',
      filename: order.payment_screenshot_filename ?? 'payment-proof',
    };
  }

  // ── Admin / Super-Admin: accept or reject ─────────────────────────────────

  /**
   * Admin / Super-Admin verifies the screenshot and accepts. The order moves
   * to `ACTIVE`, a CHARGE Transaction is recorded, and an internal invoice
   * PDF is generated.
   */
  async accept(actor: AuthPrincipal, id: string) {
    const order = await this.requireOrder(id);
    if (order.status !== OrderStatus.PROOF_SUBMITTED) {
      throw new ConflictException(
        `Order cannot be accepted from status ${order.status}`,
      );
    }
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          order_id: order.id,
          client_id: order.client_id,
          amount: order.total_amount,
          type: TxnType.CHARGE,
          status: TxnStatus.SUCCEEDED,
          payment_method: order.payment_method,
          payment_reference: order.payment_reference,
          recorded_by: actor.id,
        },
      });
      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.ACTIVE,
          approved_by: actor.id,
          paid_at: now,
          quantity_remaining: order.quantity_paid,
        },
        include: { client: CLIENT_SUMMARY },
      });
    });

    // Invoice generation does file I/O — keep it outside the DB transaction.
    let invoiceId: string | null = null;
    let invoiceNumber: string | null = null;
    try {
      const invoice = await this.invoices.createForOrder(id, actor.id);
      invoiceId = invoice.id;
      invoiceNumber = invoice.invoice_number;
    } catch (error) {
      // Order is already ACTIVE — admin can regenerate the invoice from the
      // Invoices screen. We log it loudly so it doesn't get silently lost.
      this.logger.error(`Invoice generation failed for order ${id}`, error as Error);
    }

    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_ACCEPT',
      entity: 'order',
      entityId: id,
      after: { status: updated.status, invoice_number: invoiceNumber },
    });

    this.events.emit(ORDER_ACCEPTED, {
      orderId: updated.id,
      publicOrderId: updated.public_order_id,
      clientId: updated.client_id,
      agentId: order.client.agent_id,
      acceptedBy: actor.id,
      invoiceId: invoiceId ?? '',
      invoiceNumber: invoiceNumber ?? '',
    } satisfies OrderAcceptedEvent);

    return updated;
  }

  async reject(actor: AuthPrincipal, id: string, note: string) {
    const order = await this.requireOrder(id);
    const rejectable: OrderStatus[] = [
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.PROOF_SUBMITTED,
    ];
    if (!rejectable.includes(order.status)) {
      throw new ConflictException(`Order cannot be rejected from status ${order.status}`);
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.REJECTED,
        reject_note: note,
        approved_by: actor.id,
      },
      include: { client: CLIENT_SUMMARY },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_REJECT',
      entity: 'order',
      entityId: id,
      after: { status: 'REJECTED', note },
    });
    this.events.emit(ORDER_REJECTED, {
      orderId: updated.id,
      publicOrderId: updated.public_order_id,
      clientId: updated.client_id,
      agentId: order.client.agent_id,
      rejectedBy: actor.id,
      rejectNote: note,
    } satisfies OrderRejectedEvent);
    return updated;
  }

  // ── Cancellation ──────────────────────────────────────────────────────────

  /**
   * Agent may cancel orders they're collecting payment for if the client
   * never pays (status must be `AWAITING_PAYMENT`). Admin/Super-Admin may
   * cancel any non-terminal order.
   */
  async cancel(actor: AuthPrincipal, id: string, dto: CancelOrderDto) {
    const order = await this.requireOrder(id);
    const terminal: OrderStatus[] = [
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
    ];
    if (terminal.includes(order.status)) {
      throw new ConflictException(`Order is already ${order.status}; cannot cancel`);
    }
    if (actor.role === Role.AGENT) {
      this.assertAgentOwnsOrder(actor, order);
      if (order.status !== OrderStatus.AWAITING_PAYMENT) {
        throw new ConflictException(
          'Agents may only cancel orders that are still awaiting payment',
        );
      }
    } else if (actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Not allowed to cancel orders');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelled_by: actor.id,
        cancelled_at: new Date(),
        cancelled_reason: dto.reason ?? null,
      },
      include: { client: CLIENT_SUMMARY },
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: 'ORDER_CANCEL',
      entity: 'order',
      entityId: id,
      after: { status: 'CANCELLED', reason: dto.reason },
    });
    this.events.emit(ORDER_CANCELLED, {
      orderId: updated.id,
      publicOrderId: updated.public_order_id,
      clientId: updated.client_id,
      agentId: order.client.agent_id,
      cancelledBy: actor.id,
      reason: dto.reason ?? null,
    } satisfies OrderCancelledEvent);

    return updated;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  /** Throws unless the AGENT actor owns the order's client. */
  private assertAgentOwnsOrder(actor: AuthPrincipal, order: Order & { client: Client }) {
    if (actor.role !== Role.AGENT) {
      return;
    }
    if (order.client.agent_id !== actor.id) {
      throw new ForbiddenException('This order belongs to a different agent');
    }
  }

  private generatePublicId(): string {
    return `ORD-${randomBytes(5).toString('hex').toUpperCase()}`;
  }
}
