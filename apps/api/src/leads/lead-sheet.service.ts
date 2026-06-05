import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type LeadState,
  type LeadTypeColumn,
  LeadType,
  Prisma,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OwnershipService } from '../auth/ownership.service';
import type { AuthPrincipal } from '../auth/types';
import {
  decryptField,
  isEncryptedField,
  maskValue,
  type MaskKind,
} from '../common/field-crypto';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

/**
 * One rendered cell as the sheet sees it.
 *   value      already masked + display-friendly. Always safe to send.
 *   raw        raw plaintext after decrypt — present ONLY when the caller
 *              explicitly revealed this cell via POST /reveal. Otherwise null.
 *   sensitive  true if this column is sensitive (mask applied / reveal allowed).
 */
export interface SheetCell {
  value: string | null;
  sensitive: boolean;
  raw?: string | null;
}

export interface SheetRow {
  /** Null for leads that have no assignment yet (e.g. UNSOLD_POOL). */
  assignmentId: string | null;
  leadId: string;
  publicLeadId: string;
  /** Lead lifecycle state — drives the staff assignment controls. */
  leadState: string;
  followupStatus: string;
  followupNote: string | null;
  followupUpdatedAt: Date | null;
  values: Record<string, SheetCell>;
}

export interface SheetPayload {
  leadType: LeadType;
  columns: LeadTypeColumn[];
  rows: SheetRow[];
  total: number;
  /** When non-null, pass back as `?cursor=` to fetch the next page. */
  nextCursor: string | null;
}

const PAGE_SIZE = 200;
const PAGE_SIZE_MAX = 1000;

/** Assignment-centric include (CLIENT / AGENT views + reveal). */
const ASSIGNMENT_INCLUDE = {
  lead: {
    include: {
      landing_page: { select: { id: true, name: true } },
      replacements_as_original: {
        orderBy: { created_at: 'desc' as const },
        take: 1,
        select: { status: true },
      },
    },
  },
  order: { select: { public_order_id: true } },
} satisfies Prisma.LeadAssignmentInclude;

type LoadedAssignment = Prisma.LeadAssignmentGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

/** Lead-centric include (ADMIN / SUPER_ADMIN — shows unassigned leads too). */
const LEAD_INCLUDE = {
  landing_page: { select: { id: true, name: true } },
  replacements_as_original: {
    orderBy: { created_at: 'desc' as const },
    take: 1,
    select: { status: true },
  },
  assignments: {
    orderBy: { created_at: 'desc' as const },
    take: 1,
    include: { order: { select: { public_order_id: true } } },
  },
} satisfies Prisma.LeadInclude;

type LoadedLead = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

/** Minimal assignment shape the row builder needs (null when unassigned). */
interface AssignmentLite {
  id: string;
  delivery_status: string;
  delivered_at: Date | null;
  followup_status: string;
  followup_note: string | null;
  followup_updated_at: Date | null;
  order: { public_order_id: string } | null;
}

/** A lead + its latest assignment (if any) — the unit the sheet renders. */
interface RowCtx {
  // Loosely typed so both Prisma include shapes are assignable.
  lead: {
    id: string;
    public_lead_id: string;
    lead_state: string;
    captured_at: Date | null;
    qualification: Prisma.JsonValue | null;
    landing_page: { name: string } | null;
    replacements_as_original: { status: string }[];
    [k: string]: unknown;
  };
  assignment: AssignmentLite | null;
}

@Injectable()
export class LeadSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly ownership: OwnershipService,
    private readonly audit: AuditService,
  ) {}

  // ── Column schema ─────────────────────────────────────────────────────────

  /** Public column schema for a given LeadType — used to render the headers. */
  columnsFor(leadType: LeadType): Promise<LeadTypeColumn[]> {
    return this.prisma.leadTypeColumn.findMany({
      where: { lead_type: leadType, default_visible: true },
      orderBy: { position: 'asc' },
    });
  }

  // ── Sheet rows ────────────────────────────────────────────────────────────

  /** Role-scoped page of rows for the sheet. */
  async sheet(
    actor: AuthPrincipal,
    leadType: LeadType,
    opts: { cursor?: string; limit?: number; state?: string } = {},
  ): Promise<SheetPayload> {
    const take = Math.min(opts.limit ?? PAGE_SIZE, PAGE_SIZE_MAX);
    const [columns, loaded] = await Promise.all([
      this.columnsFor(leadType),
      this.loadContexts(actor, leadType, { take, cursor: opts.cursor, state: opts.state }),
    ]);

    return {
      leadType,
      columns,
      rows: loaded.ctxs.map((ctx) => this.buildRow(ctx, columns)),
      total: loaded.total,
      nextCursor: loaded.nextCursor,
    };
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  async exportCsv(actor: AuthPrincipal, leadType: LeadType, state?: string): Promise<string> {
    const [columns, loaded] = await Promise.all([
      this.columnsFor(leadType),
      this.loadContexts(actor, leadType, { take: 10_000, state }),
    ]);

    const header = columns.map((c) => csvEscape(c.label)).join(',');
    const body = loaded.ctxs
      .map((ctx) => {
        const row = this.buildRow(ctx, columns);
        return columns.map((c) => csvEscape(row.values[c.field_key]?.value ?? '')).join(',');
      })
      .join('\n');

    return `${header}\n${body}\n`;
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  /**
   * Staff (ADMIN/SUPER_ADMIN) load lead-centric — every lead of the type in
   * scope, including unassigned ones (UNSOLD_POOL) so they can be assigned.
   * CLIENT/AGENT load assignment-centric — only leads delivered to them.
   */
  private async loadContexts(
    actor: AuthPrincipal,
    leadType: LeadType,
    opts: { take: number; cursor?: string; state?: string },
  ): Promise<{ total: number; ctxs: RowCtx[]; nextCursor: string | null }> {
    const { take, cursor, state } = opts;
    const isStaff = actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN;

    if (isStaff) {
      const where: Prisma.LeadWhereInput = {
        lead_type: leadType,
        ...(state ? { lead_state: state as LeadState } : {}),
      };
      const [total, leads] = await Promise.all([
        this.prisma.lead.count({ where }),
        this.prisma.lead.findMany({
          where,
          include: LEAD_INCLUDE,
          orderBy: [{ captured_at: 'desc' }, { id: 'desc' }],
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      ]);
      const hasMore = leads.length > take;
      const page = hasMore ? leads.slice(0, take) : leads;
      return {
        total,
        nextCursor: hasMore ? page[page.length - 1].id : null,
        ctxs: page.map((l) => this.ctxFromLead(l)),
      };
    }

    const where = this.assignmentWhere(actor, leadType, state);
    const [total, assignments] = await Promise.all([
      this.prisma.leadAssignment.count({ where }),
      this.prisma.leadAssignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    ]);
    const hasMore = assignments.length > take;
    const page = hasMore ? assignments.slice(0, take) : assignments;
    return {
      total,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      ctxs: page.map((a) => this.ctxFromAssignment(a)),
    };
  }

  private ctxFromLead(l: LoadedLead): RowCtx {
    const a = l.assignments[0];
    return {
      lead: l as unknown as RowCtx['lead'],
      assignment: a
        ? {
            id: a.id,
            delivery_status: a.delivery_status,
            delivered_at: a.delivered_at,
            followup_status: a.followup_status,
            followup_note: a.followup_note,
            followup_updated_at: a.followup_updated_at,
            order: a.order,
          }
        : null,
    };
  }

  private ctxFromAssignment(a: LoadedAssignment): RowCtx {
    return {
      lead: a.lead as unknown as RowCtx['lead'],
      assignment: {
        id: a.id,
        delivery_status: a.delivery_status,
        delivered_at: a.delivered_at,
        followup_status: a.followup_status,
        followup_note: a.followup_note,
        followup_updated_at: a.followup_updated_at,
        order: a.order,
      },
    };
  }

  // ── Reveal sensitive cells ────────────────────────────────────────────────

  /**
   * Returns plaintext for the requested sensitive `field_keys` on one
   * assignment. Audit-logged. CLIENT may only reveal cells on their own
   * assignments; staff (AGENT/ADMIN/SUPER_ADMIN) may reveal on anything in
   * their scope.
   */
  async revealCells(
    actor: AuthPrincipal,
    assignmentId: string,
    fieldKeys: string[],
  ): Promise<Record<string, string | null>> {
    if (!fieldKeys.length) {
      throw new BadRequestException('No fields requested');
    }
    const assignment = await this.prisma.leadAssignment.findUnique({
      where: { id: assignmentId },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    this.assertCanAccess(actor, assignment);

    const ctx = this.ctxFromAssignment(assignment);
    const columns = await this.prisma.leadTypeColumn.findMany({
      where: {
        lead_type: assignment.lead.lead_type,
        field_key: { in: fieldKeys },
      },
    });
    const secret = this.config.get('ENCRYPTION_KEY', { infer: true });
    const out: Record<string, string | null> = {};

    for (const col of columns) {
      if (!col.sensitive) {
        // Keep the reveal endpoint narrow — refuse non-sensitive columns.
        continue;
      }
      const raw = this.resolveRaw(col, ctx);
      out[col.field_key] = raw == null ? null : isEncryptedField(raw) ? decryptField(raw, secret) : raw;
    }

    await this.audit.record({
      actorUserId: actor.kind === 'USER' ? actor.id : null,
      action: 'LEAD_PII_REVEAL',
      entity: 'lead_assignment',
      entityId: assignmentId,
      after: { field_keys: fieldKeys, principal: actor.id, role: actor.role },
    });

    return out;
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────

  /** CLIENT updates the follow-up state on their own assignment. */
  async updateFollowup(
    actor: AuthPrincipal,
    assignmentId: string,
    status: string,
    note: string | null,
  ) {
    const assignment = await this.prisma.leadAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, client_id: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (actor.role !== Role.CLIENT || assignment.client_id !== actor.id) {
      throw new ForbiddenException('Only the buying client can update follow-up state');
    }

    const updated = await this.prisma.leadAssignment.update({
      where: { id: assignmentId },
      data: {
        followup_status: status as Prisma.EnumFollowupStatusFieldUpdateOperationsInput['set'],
        followup_note: note,
        followup_updated_at: new Date(),
        followup_updated_by: null,
      },
    });

    await this.audit.record({
      actorUserId: null,
      action: 'LEAD_FOLLOWUP_UPDATE',
      entity: 'lead_assignment',
      entityId: assignmentId,
      after: { status, note, by_client: actor.id },
    });

    return updated;
  }

  // ── Row building ──────────────────────────────────────────────────────────

  private buildRow(ctx: RowCtx, columns: LeadTypeColumn[]): SheetRow {
    const values: Record<string, SheetCell> = {};
    for (const col of columns) {
      values[col.field_key] = this.cellFor(col, ctx);
    }
    return {
      assignmentId: ctx.assignment?.id ?? null,
      leadId: ctx.lead.id,
      publicLeadId: ctx.lead.public_lead_id,
      leadState: ctx.lead.lead_state,
      followupStatus: ctx.assignment?.followup_status ?? 'NEW',
      followupNote: ctx.assignment?.followup_note ?? null,
      followupUpdatedAt: ctx.assignment?.followup_updated_at ?? null,
      values,
    };
  }

  /**
   * Resolves a column's `source` path to a displayable cell — masked when
   * the column is sensitive, formatted by `data_type` otherwise.
   */
  private cellFor(col: LeadTypeColumn, ctx: RowCtx): SheetCell {
    const raw = this.resolveRaw(col, ctx);
    if (raw == null) {
      return { value: null, sensitive: col.sensitive };
    }

    if (col.sensitive) {
      const secret = this.config.get('ENCRYPTION_KEY', { infer: true });
      const plain = isEncryptedField(raw) ? safeDecrypt(raw, secret) : raw;
      return {
        value: maskValue(plain, (col.mask_kind ?? 'full') as MaskKind),
        sensitive: true,
      };
    }

    return { value: formatValue(raw, col.data_type), sensitive: false };
  }

  /** Walks the source path. Returns the raw stored value (may be encrypted). */
  private resolveRaw(col: LeadTypeColumn, ctx: RowCtx): string | null {
    const [scope, ...rest] = col.source.split('.');
    const key = rest.join('.');
    const { lead, assignment } = ctx;
    switch (scope) {
      case 'lead': {
        return toRaw((lead as Record<string, unknown>)[key]);
      }
      case 'qualification': {
        const q = lead.qualification as Record<string, unknown> | null;
        if (!q) return null;
        return toRaw(q[key]);
      }
      case 'system':
        switch (key) {
          case 'public_lead_id': return lead.public_lead_id;
          case 'captured_at':    return lead.captured_at?.toISOString() ?? null;
          case 'lead_state':     return lead.lead_state;
          case 'landing_page':   return lead.landing_page?.name ?? null;
          default:               return null;
        }
      case 'assignment':
        if (!assignment) return null;
        switch (key) {
          case 'delivery_status':  return assignment.delivery_status;
          case 'delivered_at':     return assignment.delivered_at?.toISOString() ?? null;
          case 'followup_status':  return assignment.followup_status;
          default:                 return null;
        }
      case 'order':
        return key === 'public_order_id' ? assignment?.order?.public_order_id ?? null : null;
      case 'replacement': {
        const r = lead.replacements_as_original[0];
        return key === 'status' ? r?.status ?? null : null;
      }
      default:
        return null;
    }
  }

  // ── Scoping ───────────────────────────────────────────────────────────────

  private assignmentWhere(
    actor: AuthPrincipal,
    leadType: LeadType,
    state?: string,
  ): Prisma.LeadAssignmentWhereInput {
    const leadFilter: Prisma.LeadWhereInput = {
      lead_type: leadType,
      ...(state ? { lead_state: state as LeadState } : {}),
    };
    const base: Prisma.LeadAssignmentWhereInput = { lead: leadFilter };
    switch (actor.role) {
      case Role.AGENT:
        return { ...base, client: { agent_id: actor.id } };
      case Role.CLIENT:
        return { ...base, client_id: actor.id };
      default:
        return { id: '00000000-0000-0000-0000-000000000000' };
    }
  }

  private assertCanAccess(actor: AuthPrincipal, assignment: LoadedAssignment): void {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) return;
    if (actor.role === Role.CLIENT && assignment.client_id === actor.id) return;
    if (actor.role === Role.AGENT) {
      void this.ownership.assertCanAccessClient(actor, assignment.client_id);
      return;
    }
    throw new ForbiddenException('You do not have access to this assignment');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toRaw(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return null;
}

function safeDecrypt(encoded: string, secret: string): string {
  try {
    return decryptField(encoded, secret);
  } catch {
    return '';
  }
}

function formatValue(raw: string, dataType: string): string {
  switch (dataType) {
    case 'money':
      return raw.startsWith('$') ? raw : `$${raw}`;
    case 'boolean':
      return raw === 'true' || raw === '1' || raw.toLowerCase() === 'yes' ? 'Yes' : 'No';
    case 'date':
    case 'datetime':
      return raw;
    default:
      return raw;
  }
}

function csvEscape(value: string): string {
  if (value === '' || value == null) return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
