import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DeliveryStatus,
  LeadState,
  OrderStatus,
  type Prisma,
  ReplacementStatus,
  Role,
} from '@prisma/client';
import type { AuthPrincipal } from '../auth/types';
import { DistributionService } from '../distribution/distribution.service';
import {
  LEAD_ASSIGNED,
  type LeadAssignedEvent,
  REPLACEMENT_STATUS_CHANGED,
  type ReplacementStatusChangedEvent,
} from '../events/realtime-events';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReplacementDto } from './dto/create-replacement.dto';
import { ReplacementPolicyService } from './replacement-policy.service';

const TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const;

/** Relations embedded in every replacement response. */
const REPLACEMENT_INCLUDE = {
  original_lead: { select: { id: true, public_lead_id: true, full_name: true } },
  replacement_lead: { select: { id: true, public_lead_id: true } },
  order: { select: { id: true, public_order_id: true } },
  client: { select: { id: true, full_name: true, business_name: true } },
} satisfies Prisma.ReplacementInclude;

@Injectable()
export class ReplacementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly distribution: DistributionService,
    private readonly policy: ReplacementPolicyService,
    private readonly events: EventEmitter2,
  ) {}

  /** CLIENT requests a replacement on one of their delivered leads. */
  async create(actor: AuthPrincipal, dto: CreateReplacementDto) {
    const policy = await this.policy.get();
    if (!policy.validReasons.includes(dto.reason)) {
      throw new BadRequestException(`Reason must be one of: ${policy.validReasons.join(', ')}`);
    }

    // The lead must have been delivered to THIS client.
    const assignment = await this.prisma.leadAssignment.findFirst({
      where: { client_id: actor.id, lead_id: dto.original_lead_id },
    });
    if (!assignment) {
      throw new NotFoundException('You have no delivered lead with that id');
    }
    if (assignment.delivery_status !== DeliveryStatus.DELIVERED || !assignment.delivered_at) {
      throw new BadRequestException('This lead has not been delivered yet');
    }
    const windowMs = policy.windowHours * 3_600_000;
    if (Date.now() - assignment.delivered_at.getTime() > windowMs) {
      throw new BadRequestException(`The ${policy.windowHours}h replacement window has passed`);
    }

    const pending = await this.prisma.replacement.findFirst({
      where: {
        client_id: actor.id,
        original_lead_id: dto.original_lead_id,
        status: { in: [ReplacementStatus.REQUESTED, ReplacementStatus.REVIEW] },
      },
    });
    if (pending) {
      throw new ConflictException('A replacement for this lead is already pending');
    }

    const replacement = await this.prisma.replacement.create({
      data: {
        original_lead_id: dto.original_lead_id,
        order_id: assignment.order_id,
        client_id: actor.id,
        reason: dto.reason,
        status: ReplacementStatus.REQUESTED,
      },
      include: REPLACEMENT_INCLUDE,
    });
    await this.prisma.lead.update({
      where: { id: dto.original_lead_id },
      data: { lead_state: LeadState.REPLACEMENT_REQUESTED },
    });
    return replacement;
  }

  /** CLIENT → own; AGENT → their clients'; ADMIN/SUPER → all. */
  list(actor: AuthPrincipal) {
    return this.prisma.replacement.findMany({
      where: this.scope(actor),
      include: REPLACEMENT_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const replacement = await this.prisma.replacement.findFirst({
      where: { id, ...this.scope(actor) },
      include: REPLACEMENT_INCLUDE,
    });
    if (!replacement) {
      throw new NotFoundException('Replacement not found');
    }
    return replacement;
  }

  /**
   * ADMIN/SUPER_ADMIN approve. In one transaction: credit the order balance,
   * mark the original lead REPLACED, and run order-centric matching to issue
   * a fresh coded replacement lead. The new lead is delivered + the client is
   * notified after the transaction commits.
   */
  async approve(actor: AuthPrincipal, id: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const replacement = await tx.replacement.findUnique({ where: { id } });
      if (!replacement) {
        throw new NotFoundException('Replacement not found');
      }
      if (
        replacement.status !== ReplacementStatus.REQUESTED &&
        replacement.status !== ReplacementStatus.REVIEW
      ) {
        throw new ConflictException(`Replacement already ${replacement.status}`);
      }

      // Lock the order and credit its balance +1.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${replacement.order_id}::uuid FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: replacement.order_id } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          quantity_remaining: { increment: 1 },
          status: order.status === OrderStatus.COMPLETED ? OrderStatus.FULFILLING : order.status,
        },
      });

      // Mark the original lead REPLACED.
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${replacement.original_lead_id}::uuid FOR UPDATE`;
      await tx.lead.update({
        where: { id: replacement.original_lead_id },
        data: { lead_state: LeadState.REPLACED },
      });

      // Order-centric matching → a fresh coded replacement lead (if available).
      const code = `RPL-${randomBytes(4).toString('hex').toUpperCase()}`;
      const creditedOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      const assignment = await this.distribution.claimReplacementLead(tx, creditedOrder, code);

      const updated = await tx.replacement.update({
        where: { id },
        data: {
          // REPLACED once a fresh lead is issued; APPROVED when the +1 credit
          // is pending (no matching lead currently in the pool).
          status: assignment ? ReplacementStatus.REPLACED : ReplacementStatus.APPROVED,
          reviewed_by: actor.id,
          replacement_lead_id: assignment?.lead_id ?? null,
          replacement_code: code,
        },
        include: REPLACEMENT_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actor_user_id: actor.id,
          action: 'REPLACEMENT_APPROVE',
          entity: 'replacement',
          entity_id: id,
          after: {
            replacementCode: code,
            replacementAssignmentId: assignment?.id ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        replacement: updated,
        assignmentId: assignment?.id ?? null,
        clientId: replacement.client_id,
      };
    }, TX_OPTIONS);

    // Deliver the fresh lead over the socket, then notify the client live.
    if (outcome.assignmentId) {
      this.events.emit(LEAD_ASSIGNED, {
        assignmentId: outcome.assignmentId,
      } satisfies LeadAssignedEvent);
    }
    this.notify(outcome.clientId, id, outcome.replacement.status);
    return outcome.replacement;
  }

  /** ADMIN/SUPER_ADMIN deny — record the note; the original lead stays ACCEPTED. */
  async deny(actor: AuthPrincipal, id: string, note: string) {
    const replacement = await this.prisma.replacement.findUnique({ where: { id } });
    if (!replacement) {
      throw new NotFoundException('Replacement not found');
    }
    if (
      replacement.status !== ReplacementStatus.REQUESTED &&
      replacement.status !== ReplacementStatus.REVIEW
    ) {
      throw new ConflictException(`Replacement already ${replacement.status}`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.replacement.update({
        where: { id },
        data: {
          status: ReplacementStatus.DENIED,
          review_note: note,
          reviewed_by: actor.id,
        },
        include: REPLACEMENT_INCLUDE,
      }),
      this.prisma.lead.update({
        where: { id: replacement.original_lead_id },
        data: { lead_state: LeadState.ACCEPTED },
      }),
      this.prisma.auditLog.create({
        data: {
          actor_user_id: actor.id,
          action: 'REPLACEMENT_DENY',
          entity: 'replacement',
          entity_id: id,
          after: { note } as Prisma.InputJsonValue,
        },
      }),
    ]);

    this.notify(replacement.client_id, id, ReplacementStatus.DENIED);
    return updated;
  }

  /** Per-client replacement-rate metric: replacements / delivered leads. */
  async rate(clientId: string) {
    const [replacements, deliveredLeads] = await Promise.all([
      this.prisma.replacement.count({ where: { client_id: clientId } }),
      this.prisma.leadAssignment.count({
        where: { client_id: clientId, delivery_status: DeliveryStatus.DELIVERED },
      }),
    ]);
    return {
      clientId,
      replacements,
      deliveredLeads,
      rate: deliveredLeads > 0 ? Number((replacements / deliveredLeads).toFixed(4)) : 0,
    };
  }

  private notify(clientId: string, replacementId: string, status: string): void {
    this.events.emit(REPLACEMENT_STATUS_CHANGED, {
      clientId,
      replacementId,
      status,
    } satisfies ReplacementStatusChangedEvent);
  }

  private scope(actor: AuthPrincipal): Prisma.ReplacementWhereInput {
    switch (actor.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN:
        return {};
      case Role.AGENT:
        return { client: { agent_id: actor.id } };
      case Role.CLIENT:
        return { client_id: actor.id };
      default:
        return { id: '00000000-0000-0000-0000-000000000000' };
    }
  }
}
