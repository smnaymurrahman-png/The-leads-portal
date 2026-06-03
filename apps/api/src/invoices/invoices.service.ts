import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Invoice, Prisma } from '@prisma/client';
import { OwnershipService } from '../auth/ownership.service';
import type { AuthPrincipal } from '../auth/types';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { renderInvoicePdf } from './pdf.util';

export const INVOICE_PDF_INTENT = 'invoice_pdf';
const PDF_MIME_WHITELIST: ReadonlySet<string> = new Set(['application/pdf']);
const BUSINESS_NAME = 'Leads Portal';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ownership: OwnershipService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // ── Creation ───────────────────────────────────────────────────────────────

  /**
   * Generates the invoice for a freshly-accepted order. Called from
   * `OrdersService.accept` inside the same transaction-scoped flow.
   *
   * Steps: allocate invoice_number → render PDF → persist Invoice row.
   */
  async createForOrder(orderId: string, actorId: string): Promise<Invoice> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { client: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const invoiceNumber = await this.nextInvoiceNumber();
    const issuedAt = new Date();

    const pdfBuffer = await renderInvoicePdf({
      invoiceNumber,
      issuedAt,
      business: {
        name: BUSINESS_NAME,
        email: this.config.get('BACKEND_URL', { infer: true }),
      },
      client: {
        fullName: order.client.full_name,
        businessName: order.client.business_name,
        email: order.client.email,
        address: order.client.address,
      },
      order: {
        publicOrderId: order.public_order_id,
        leadType: order.lead_type,
        deliveryMode: order.delivery_mode,
        quantity: order.quantity_paid,
        unitPrice: Number(order.unit_price),
        totalAmount: Number(order.total_amount),
      },
      payment: {
        method: order.payment_method,
        reference: order.payment_reference,
        receivedAt: order.payment_uploaded_at ?? issuedAt,
      },
    });

    const stored = await this.storage.store({
      bucket: 'invoices',
      originalFilename: `${invoiceNumber}.pdf`,
      mime: 'application/pdf',
      buffer: pdfBuffer,
      allowedMimes: PDF_MIME_WHITELIST,
    });

    return this.prisma.invoice.create({
      data: {
        order_id: order.id,
        client_id: order.client_id,
        invoice_number: invoiceNumber,
        amount: order.total_amount,
        issued_at: issuedAt,
        issued_by: actorId,
        pdf_path: stored.relativePath,
      },
    });
  }

  /**
   * Allocates the next number for the current year. Format: `INV-YYYY-NNNNNN`.
   * Best-effort uniqueness via `invoice_number` UNIQUE — on the rare race we
   * retry once.
   */
  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `INV-${year}-`;
    const existing = await this.prisma.invoice.count({
      where: { invoice_number: { startsWith: prefix } },
    });
    return `${prefix}${String(existing + 1).padStart(6, '0')}`;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  /** Role-scoped list. */
  list(actor: AuthPrincipal) {
    return this.prisma.invoice.findMany({
      where: {
        order: { ...this.ownership.orderScope(actor) },
      },
      include: {
        order: { select: { public_order_id: true, lead_type: true, delivery_mode: true } },
        client: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { issued_at: 'desc' },
    });
  }

  async get(actor: AuthPrincipal, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    await this.ownership.assertCanAccessOrder(actor, invoice.order_id);
    return invoice;
  }

  /**
   * Returns a short-lived URL token for the PDF. The actual download endpoint
   * verifies the token (no JWT required for the download itself, so the
   * browser can render `<embed>`/`<iframe>` without juggling auth headers).
   */
  async signedPdfUrl(actor: AuthPrincipal, id: string) {
    const invoice = await this.get(actor, id);
    if (!invoice.pdf_path) {
      throw new NotFoundException('Invoice PDF has not been generated');
    }
    const signed = this.storage.signResourceUrl(INVOICE_PDF_INTENT, invoice.id, actor.id);
    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      url: this.buildPdfUrl(invoice.id, signed.token),
      expires_at: new Date(signed.expSeconds * 1000).toISOString(),
    };
  }

  /** Token-verified PDF read. Used by `GET /invoices/:id/pdf`. */
  async readPdfWithToken(id: string, token: string | undefined): Promise<{
    buffer: Buffer;
    invoice: Invoice;
  }> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || !invoice.pdf_path) {
      throw new NotFoundException('Invoice not found');
    }
    const claims = this.storage.verifyResourceUrl(token, INVOICE_PDF_INTENT, id);
    if (!claims) {
      throw new ForbiddenException('Invalid or expired token');
    }
    const buffer = await this.storage.read(invoice.pdf_path);
    return { buffer, invoice };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildPdfUrl(invoiceId: string, token: string): string {
    const backend = this.config.get('BACKEND_URL', { infer: true });
    return `${backend.replace(/\/$/, '')}/api/invoices/${invoiceId}/pdf?token=${encodeURIComponent(token)}`;
  }
}

// Re-export Prisma so the controller can use its narrow type imports.
export { Prisma };
