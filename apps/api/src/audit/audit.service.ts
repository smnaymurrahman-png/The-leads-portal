import { Injectable, Logger } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  /** Audit viewer query — newest first, optionally filtered. */
  list(query: { entity?: string; action?: string; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: { entity: query.entity, action: query.action },
      include: { actor: { select: { id: true, full_name: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: Math.min(query.limit ?? 100, 500),
    });
  }
}
