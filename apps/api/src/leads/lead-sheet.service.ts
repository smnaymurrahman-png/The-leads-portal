import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type LeadAssignment,
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
  assignmentId: string;
  leadId: string;
  publicLeadId: string;
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

/**
 * The Prisma include block needed to resolve every supported source path.
 * Centralised so the row query and the export query stay consistent.
 */
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
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<SheetPayload> {
    const take = Math.min(opts.limit ?? PAGE_SIZE, PAGE_SIZE_MAX);
    const where = this.assignmentWhere(actor, leadType);

    const [columns, total, assignments] = await Promise.all([
      this.columnsFor(leadType),
      this.prisma.leadAssignment.count({ where }),
      this.prisma.leadAssignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasMore = assignments.length > take;
    const pageRows = hasMore ? assignments.slice(0, take) : assignments;
    const rows = pageRows.map((a) => this.buildRow(a, columns));

    return {
      leadType,
      columns,
      rows,
      total,
      nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
    };
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  async exportCsv(actor: AuthPrincipal, leadType: LeadType): Promise<string> {
    const [columns, assignments] = await Promise.all([
      this.columnsFor(leadType),
      this.prisma.leadAssignment.findMany({
        where: this.assignmentWhere(actor, leadType),
        include: ASSIGNMENT_INCLUDE,
        orderBy: { created_at: 'desc' },
        take: 10_000, // hard cap — UI warns above this; sensible for now
      }),
    ]);

    const header = columns.map((c) => csvEscape(c.label)).join(',');
    const body = assignments
      .map((a) => {
        const row = this.buildRow(a, columns);
        return columns.map((c) => csvEscape(row.values[c.field_key]?.value ?? '')).join(',');
      })
      .join('\n');

    return `${header}\n${body}\n`;
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
        // Don't enable bulk de-mask of non-sensitive columns through this path
        // — refuse, so the reveal endpoint stays narrow.
        continue;
      }
      const raw = this.resolveRaw(col, assignment);
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
        // For CLIENT actors, `followup_updated_by` refers to the User table.
        // Clients aren't Users, so we leave it null and rely on the audit log
        // (below) to credit the change to the CLIENT principal.
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

  private buildRow(assignment: LoadedAssignment, columns: LeadTypeColumn[]): SheetRow {
    const values: Record<string, SheetCell> = {};
    for (const col of columns) {
      values[col.field_key] = this.cellFor(col, assignment);
    }
    return {
      assignmentId: assignment.id,
      leadId: assignment.lead.id,
      publicLeadId: assignment.lead.public_lead_id,
      followupStatus: assignment.followup_status,
      followupNote: assignment.followup_note,
      followupUpdatedAt: assignment.followup_updated_at,
      values,
    };
  }

  /**
   * Resolves a column's `source` path to a displayable cell — masked when
   * the column is sensitive, formatted by `data_type` otherwise.
   */
  private cellFor(col: LeadTypeColumn, assignment: LoadedAssignment): SheetCell {
    const raw = this.resolveRaw(col, assignment);
    if (raw == null) {
      return { value: null, sensitive: col.sensitive };
    }

    if (col.sensitive) {
      // Don't ship plaintext for sensitive cells — even if the stored value
      // happens to be plaintext (legacy). Always mask the display.
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
  private resolveRaw(col: LeadTypeColumn, a: LoadedAssignment): string | null {
    const [scope, ...rest] = col.source.split('.');
    const key = rest.join('.');
    switch (scope) {
      case 'lead': {
        const lead = a.lead as Record<string, unknown>;
        return toRaw(lead[key]);
      }
      case 'qualification': {
        const q = a.lead.qualification as Record<string, unknown> | null;
        if (!q) return null;
        return toRaw(q[key]);
      }
      case 'system':
        switch (key) {
          case 'public_lead_id': return a.lead.public_lead_id;
          case 'captured_at':    return a.lead.captured_at?.toISOString() ?? null;
          case 'lead_state':     return a.lead.lead_state;
          case 'landing_page':   return a.lead.landing_page?.name ?? null;
          default:               return null;
        }
      case 'assignment':
        switch (key) {
          case 'delivery_status':  return a.delivery_status;
          case 'delivered_at':     return a.delivered_at?.toISOString() ?? null;
          case 'followup_status':  return a.followup_status;
          default:                 return null;
        }
      case 'order':
        return key === 'public_order_id' ? a.order.public_order_id : null;
      case 'replacement': {
        const r = a.lead.replacements_as_original[0];
        return key === 'status' ? r?.status ?? null : null;
      }
      default:
        return null;
    }
  }

  // ── Scoping ───────────────────────────────────────────────────────────────

  private assignmentWhere(actor: AuthPrincipal, leadType: LeadType): Prisma.LeadAssignmentWhereInput {
    const base: Prisma.LeadAssignmentWhereInput = {
      lead: { lead_type: leadType },
    };
    switch (actor.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN:
        return base;
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
      // Defer to the ownership service to check agent-owns-client.
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
      // Already stored as a number-ish string; render with $ prefix if missing.
      return raw.startsWith('$') ? raw : `$${raw}`;
    case 'boolean':
      return raw === 'true' || raw === '1' || raw.toLowerCase() === 'yes' ? 'Yes' : 'No';
    case 'date':
    case 'datetime':
      // ISO 8601 strings round-trip fine to the browser; format client-side.
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
