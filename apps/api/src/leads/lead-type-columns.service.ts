import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type LeadType, type LeadTypeColumn, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateLeadTypeColumnDto,
  ReorderLeadTypeColumnsDto,
  UpdateLeadTypeColumnDto,
} from './dto/lead-type-column.dto';

/**
 * Admin-side CRUD on `LeadTypeColumn`. Read access lives in `LeadSheetService`
 * (which the public sheet endpoint hits). Mutations are SUPER_ADMIN only —
 * enforced at the controller via `@Roles`.
 */
@Injectable()
export class LeadTypeColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Admin view: every column for the lead_type, including invisible ones. */
  listAll(leadType: LeadType): Promise<LeadTypeColumn[]> {
    return this.prisma.leadTypeColumn.findMany({
      where: { lead_type: leadType },
      orderBy: { position: 'asc' },
    });
  }

  async create(actor: AuthPrincipal, dto: CreateLeadTypeColumnDto): Promise<LeadTypeColumn> {
    if (dto.sensitive && !dto.mask_kind) {
      throw new BadRequestException('mask_kind is required when sensitive=true');
    }
    // Append: position = current max + 1.
    const last = await this.prisma.leadTypeColumn.findFirst({
      where: { lead_type: dto.lead_type },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? 0) + 1;

    try {
      const created = await this.prisma.leadTypeColumn.create({
        data: {
          lead_type:       dto.lead_type,
          position,
          field_key:       dto.field_key,
          label:           dto.label,
          source:          dto.source,
          data_type:       dto.data_type ?? 'string',
          sensitive:       dto.sensitive ?? false,
          mask_kind:       dto.mask_kind ?? null,
          default_visible: dto.default_visible ?? true,
        },
      });
      await this.audit.record({
        actorUserId: actor.id,
        action: 'LEAD_COLUMN_CREATE',
        entity: 'lead_type_column',
        entityId: created.id,
        after: { lead_type: dto.lead_type, field_key: dto.field_key, label: dto.label },
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `A column with field_key "${dto.field_key}" already exists for ${dto.lead_type}`,
        );
      }
      throw error;
    }
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateLeadTypeColumnDto): Promise<LeadTypeColumn> {
    const before = await this.prisma.leadTypeColumn.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException('Column not found');
    }
    // When flipping `sensitive` on, mask_kind must be set (now or already on the row).
    const sensitiveNext = dto.sensitive ?? before.sensitive;
    const maskNext = dto.mask_kind === undefined ? before.mask_kind : dto.mask_kind;
    if (sensitiveNext && !maskNext) {
      throw new BadRequestException('mask_kind is required when sensitive=true');
    }

    const updated = await this.prisma.leadTypeColumn.update({
      where: { id },
      data: {
        label:           dto.label ?? undefined,
        source:          dto.source ?? undefined,
        data_type:       dto.data_type ?? undefined,
        sensitive:       dto.sensitive ?? undefined,
        mask_kind:       dto.mask_kind === undefined ? undefined : dto.mask_kind,
        default_visible: dto.default_visible ?? undefined,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'LEAD_COLUMN_UPDATE',
      entity: 'lead_type_column',
      entityId: id,
      before: { ...before },
      after: { ...updated },
    });
    return updated;
  }

  async remove(actor: AuthPrincipal, id: string): Promise<void> {
    const row = await this.prisma.leadTypeColumn.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Column not found');
    }
    await this.prisma.$transaction([
      this.prisma.leadTypeColumn.delete({ where: { id } }),
      // Renumber the gap so positions stay 1..N (purely cosmetic; the sheet
      // sorts by position, but admins like dense numbering).
      this.prisma.$executeRaw`
        UPDATE lead_type_columns
        SET position = position - 1
        WHERE lead_type = ${row.lead_type}::"LeadType" AND position > ${row.position}
      `,
    ]);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'LEAD_COLUMN_DELETE',
      entity: 'lead_type_column',
      entityId: id,
      before: { ...row },
    });
  }

  /**
   * Atomic reorder. The body must contain EVERY `field_key` currently in this
   * lead_type — no adds, no removes. Two-phase to avoid violating the
   * `(lead_type, position)` unique constraint mid-transaction.
   */
  async reorder(actor: AuthPrincipal, dto: ReorderLeadTypeColumnsDto): Promise<LeadTypeColumn[]> {
    const current = await this.prisma.leadTypeColumn.findMany({
      where: { lead_type: dto.lead_type },
      select: { id: true, field_key: true },
    });
    if (current.length !== dto.order.length) {
      throw new BadRequestException(
        `reorder must contain exactly ${current.length} field_keys (got ${dto.order.length})`,
      );
    }
    const currentKeys = new Set(current.map((c) => c.field_key));
    for (const key of dto.order) {
      if (!currentKeys.has(key)) {
        throw new BadRequestException(`Unknown field_key "${key}"`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Phase 1 — shift every row out of the way (positions become old+10000).
      await tx.$executeRaw`
        UPDATE lead_type_columns
        SET position = position + 10000
        WHERE lead_type = ${dto.lead_type}::"LeadType"
      `;
      // Phase 2 — assign final positions 1..N.
      for (let i = 0; i < dto.order.length; i++) {
        await tx.leadTypeColumn.update({
          where: { lead_type_field_key: { lead_type: dto.lead_type, field_key: dto.order[i] } },
          data: { position: i + 1 },
        });
      }
    });

    const after = await this.listAll(dto.lead_type);
    await this.audit.record({
      actorUserId: actor.id,
      action: 'LEAD_COLUMN_REORDER',
      entity: 'lead_type_column',
      entityId: null,
      after: { lead_type: dto.lead_type, order: dto.order },
    });
    return after;
  }
}
