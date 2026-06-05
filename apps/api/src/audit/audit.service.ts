import { Injectable, Logger } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListAuditQueryDto } from './dto/list-audit-query.dto';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
}

/**
 * Central audit trail. `record()` is best-effort — a failed audit write is
 * logged but never breaks the action it was recording.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actor_user_id: entry.actorUserId ?? null,
          action: entry.action,
          entity: entry.entity,
          entity_id: entry.entityId ?? null,
          before: toJson(entry.before),
          after: toJson(entry.after),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit entry "${entry.action}"`, error as Error);
    }
  }

  /**
   * Audit viewer query — newest first, with full filter set and cursor
   * pagination. Returns `nextCursor=null` when no more rows.
   */
  async list(query: ListAuditQueryDto) {
    const where = this.buildWhere(query);
    const take = Math.min(query.limit ?? 100, 500);

    const rows = await this.prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, full_name: true, role: true } } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      rows: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Summary endpoint: distinct actions + distinct actors in the same window.
   * Powers the filter chips and the actor dropdown without needing to load
   * the full result set client-side.
   */
  async summary(query: ListAuditQueryDto) {
    const where = this.buildWhere(query);

    const [byAction, byActor, total] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      this.prisma.auditLog.findMany({
        where: { ...where, actor_user_id: { not: null } },
        distinct: ['actor_user_id'],
        select: {
          actor_user_id: true,
          actor: { select: { full_name: true, role: true } },
        },
        take: 200,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      total,
      actions: byAction.map((r) => ({ action: r.action, count: r._count.action })),
      actors: byActor
        .filter((r) => r.actor_user_id !== null)
        .map((r) => ({
          id: r.actor_user_id as string,
          name: r.actor?.full_name ?? '(unknown)',
          role: r.actor?.role ?? 'CLIENT',
        })),
    };
  }

  private buildWhere(query: ListAuditQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entity) where.entity = query.entity;
    if (query.actor_user_id) where.actor_user_id = query.actor_user_id;
    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) where.created_at.gte = new Date(query.from);
      if (query.to) where.created_at.lt = new Date(query.to);
    }
    if (query.q) {
      where.entity_id = { contains: query.q, mode: 'insensitive' };
    }
    // `actions` (multi) takes precedence over the single `action` field.
    if (query.actions && query.actions.length > 0) {
      where.action = { in: query.actions };
    } else if (query.action) {
      where.action = query.action;
    }
    return where;
  }
}
