import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AssignmentType,
  DeliveryMode,
  DeliveryStatus,
  type Lead,
  type LeadAssignment,
  LeadState,
  type Order,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import type { AuthPrincipal } from '../auth/types';
import { LEAD_VALID, type LeadValidEvent } from '../events/lead-events';
import { LEAD_ASSIGNED, type LeadAssignedEvent } from '../events/realtime-events';
import { PrismaService } from '../prisma/prisma.service';
import { matchesCriteria } from './criteria-match';
import { DistributionControlsService } from './distribution-controls.service';

/** A SHARED lead may be assigned to at most this many orders. */
const MAX_SHARED = 4;

/** Generous bounds — heavy contention serialises many lead transactions. */
const TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const;

type TxClient = Prisma.TransactionClient;

export interface DistributionResult {
  leadId: string;
  state: LeadState;
  assignmentCount: number;
  /** Ids of the assignments created — handed to the delivery layer post-commit. */
  assignmentIds: string[];
  skipped: boolean;
  reason?: string;
}

/** Orders highest priority first, then oldest paid, then round-robin. */
function sortEligible(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    if (a.queue_priority !== b.queue_priority) {
      return b.queue_priority - a.queue_priority; // queue_priority DESC
    }
    const aPaid = a.paid_at?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bPaid = b.paid_at?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aPaid !== bPaid) {
      return aPaid - bPaid; // paid_at ASC (oldest first)
    }
    // Exact tie → round-robin: least-recently-served first (never-served wins).
    const aServed = a.last_served_at?.getTime() ?? 0;
    const bServed = b.last_served_at?.getTime() ?? 0;
    if (aServed !== bServed) {
      return aServed - bServed;
    }
    return a.id < b.id ? -1 : 1; // stable, deterministic final tiebreak
  });
}

/**
 * The Lead Distribution Engine.
 *
 * Concurrency model — for every distribution (auto or manual):
 *   1. open ONE transaction;
 *   2. `SELECT ... FOR UPDATE` the lead row — serialises all work for that lead;
 *   3. `SELECT ... FOR UPDATE` each target order row in a fixed id order
 *      (deadlock-safe), re-checking `quantity_remaining` after the lock;
 *   4. create the assignment + decrement the balance, atomically.
 * Nothing is delivered before this transaction commits.
 */
@Injectable()
export class DistributionService {
  private readonly logger = new Logger(DistributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: DistributionControlsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Auto-distribution trigger — intake emits this when a lead becomes VALID. */
  @OnEvent(LEAD_VALID)
  async onLeadValid(event: LeadValidEvent): Promise<void> {
    try {
      const result = await this.distribute(event.leadId);
      this.logger.log(
        `Lead ${event.leadId} → ${result.state} (${result.assignmentCount} assignment(s))`,
      );
    } catch (error) {
      this.logger.error(`Auto-distribution failed for lead ${event.leadId}`, error as Error);
    }
  }

  /** Runs the matching algorithm for one lead inside a single transaction. */
  async distribute(leadId: string): Promise<DistributionResult> {
    const result = await this.prisma.$transaction(
      (tx) => this.runDistribution(tx, leadId),
      TX_OPTIONS,
    );
    // Hand the committed assignments to the delivery layer.
    this.emitAssigned(result.assignmentIds);
    return result;
  }

  /** Emits `lead.assigned` for each new assignment (delivery runs after commit). */
  private emitAssigned(assignmentIds: string[]): void {
    for (const assignmentId of assignmentIds) {
      this.events.emit(LEAD_ASSIGNED, { assignmentId } satisfies LeadAssignedEvent);
    }
  }

  private async runDistribution(tx: TxClient, leadId: string): Promise<DistributionResult> {
    // Lock the lead row — serialises every assignment decision for this lead.
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId}::uuid FOR UPDATE`;

    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    // Only distribute a fresh VALID lead, or re-run one stuck in the pool.
    if (lead.lead_state !== LeadState.VALID && lead.lead_state !== LeadState.UNSOLD_POOL) {
      return {
        leadId,
        state: lead.lead_state,
        assignmentCount: 0,
        assignmentIds: [],
        skipped: true,
        reason: `lead is ${lead.lead_state}`,
      };
    }

    // Pause / hold-for-review — leave the lead VALID for an admin to handle.
    const block = await this.controls.isBlocked(lead.lead_type);
    if (block.blocked) {
      return {
        leadId,
        state: lead.lead_state,
        assignmentCount: 0,
        assignmentIds: [],
        skipped: true,
        reason: block.reason,
      };
    }

    // (1) eligible set
    const eligible = await this.findEligibleOrders(tx, lead);

    // (2) empty → UNSOLD_POOL and stop
    if (eligible.length === 0) {
      await tx.lead.update({ where: { id: leadId }, data: { lead_state: LeadState.UNSOLD_POOL } });
      return {
        leadId,
        state: LeadState.UNSOLD_POOL,
        assignmentCount: 0,
        assignmentIds: [],
        skipped: false,
        reason: 'no eligible orders',
      };
    }

    // (3) sort by priority, paid_at, round-robin
    const sorted = sortEligible(eligible);

    // (4)/(5) pick targets: one EXCLUSIVE, or up to 4 SHARED
    const front = sorted[0];
    const targets =
      front.delivery_mode === DeliveryMode.EXCLUSIVE
        ? [front]
        : sorted.filter((order) => order.delivery_mode === DeliveryMode.SHARED).slice(0, MAX_SHARED);

    // Lock every target order row FOR UPDATE in ascending id order — two
    // concurrent leads touching the same orders lock them in the same
    // sequence, so they queue rather than deadlock.
    const targetIds = [...new Set(targets.map((order) => order.id))].sort();
    for (const id of targetIds) {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
    }

    // Re-read the now-locked orders to get their authoritative current state.
    const locked = await tx.order.findMany({ where: { id: { in: targetIds } } });
    const lockedById = new Map(locked.map((order) => [order.id, order]));

    const assignmentIds: string[] = [];
    for (const target of targets) {
      const order = lockedById.get(target.id);
      if (!order) {
        continue;
      }
      // Re-check after locking — never over-fill, never go below zero.
      if (order.quantity_remaining <= 0) {
        continue;
      }
      if (order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.FULFILLING) {
        continue;
      }

      const assignment = await this.assignOne(tx, lead, order, AssignmentType.AUTO, null);
      assignmentIds.push(assignment.id);

      // EXCLUSIVE → exactly one assignment, then stop.
      if (order.delivery_mode === DeliveryMode.EXCLUSIVE) {
        break;
      }
    }

    const finalState = assignmentIds.length > 0 ? LeadState.ASSIGNED : LeadState.UNSOLD_POOL;
    await tx.lead.update({ where: { id: leadId }, data: { lead_state: finalState } });
    return {
      leadId,
      state: finalState,
      assignmentCount: assignmentIds.length,
      assignmentIds,
      skipped: false,
    };
  }

  /** Builds the eligible set: type + status + balance + criteria + daily cap. */
  private async findEligibleOrders(tx: TxClient, lead: Lead): Promise<Order[]> {
    const candidates = await tx.order.findMany({
      where: {
        lead_type: lead.lead_type,
        status: { in: [OrderStatus.ACTIVE, OrderStatus.FULFILLING] },
        quantity_remaining: { gt: 0 },
      },
    });

    const matching = candidates.filter((order) => matchesCriteria(order.criteria, lead));
    const capped = matching.filter((order) => order.daily_cap !== null);
    if (capped.length === 0) {
      return matching;
    }

    // Exclude orders that have already hit today's delivery cap.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const counts = await tx.leadAssignment.groupBy({
      by: ['order_id'],
      where: { order_id: { in: capped.map((o) => o.id) }, created_at: { gte: startOfToday } },
      _count: true,
    });
    const todayCount = new Map(counts.map((row) => [row.order_id, row._count]));

    return matching.filter((order) => {
      if (order.daily_cap === null) {
        return true;
      }
      return (todayCount.get(order.id) ?? 0) < order.daily_cap;
    });
  }

  /** Creates one assignment + decrements the order, inside the caller's tx. */
  private async assignOne(
    tx: TxClient,
    lead: Lead,
    order: Order,
    type: AssignmentType,
    assignedBy: string | null,
  ) {
    const assignment = await tx.leadAssignment.create({
      data: {
        lead_id: lead.id,
        order_id: order.id,
        client_id: order.client_id,
        assignment_type: type,
        delivery_mode: order.delivery_mode,
        delivery_status: DeliveryStatus.PENDING,
        // revenue is intentionally NOT booked here — only on confirmed delivery
        assigned_by: assignedBy,
      },
    });

    const remaining = order.quantity_remaining - 1;
    await tx.order.update({
      where: { id: order.id },
      data: {
        quantity_remaining: remaining,
        last_served_at: new Date(),
        status:
          remaining === 0
            ? OrderStatus.COMPLETED
            : order.status === OrderStatus.ACTIVE
              ? OrderStatus.FULFILLING
              : order.status,
      },
    });
    return assignment;
  }

  /**
   * MANUAL path — ADMIN/SUPER_ADMIN assigns a lead to a specific order,
   * overriding the matching algorithm. Same locking + balance checks; the
   * per-lead exclusive/shared constraints are enforced here and in the DB.
   */
  async manualAssign(
    actor: AuthPrincipal,
    leadId: string,
    orderId: string,
  ): Promise<DistributionResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId}::uuid FOR UPDATE`;
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.FULFILLING) {
        throw new ConflictException(`Order is ${order.status}; it cannot receive leads`);
      }
      if (order.quantity_remaining <= 0) {
        throw new ConflictException('Order has no remaining balance');
      }
      if (order.lead_type !== lead.lead_type) {
        throw new ConflictException('Order lead type does not match the lead');
      }

      // Per-lead constraints — checked in code; DB index/trigger are the backstop.
      const existing = await tx.leadAssignment.findMany({ where: { lead_id: leadId } });
      if (existing.some((a) => a.order_id === orderId)) {
        throw new ConflictException('Lead is already assigned to this order');
      }
      if (existing.some((a) => a.delivery_mode === DeliveryMode.EXCLUSIVE)) {
        throw new ConflictException('Lead already has an exclusive assignment');
      }
      if (order.delivery_mode === DeliveryMode.EXCLUSIVE && existing.length > 0) {
        throw new ConflictException('Lead is already assigned; an exclusive assignment is not possible');
      }
      if (
        order.delivery_mode === DeliveryMode.SHARED &&
        existing.filter((a) => a.delivery_mode === DeliveryMode.SHARED).length >= MAX_SHARED
      ) {
        throw new ConflictException('Lead already has the maximum of 4 shared assignments');
      }

      const assignment = await this.assignOne(tx, lead, order, AssignmentType.MANUAL, actor.id);
      await tx.lead.update({ where: { id: leadId }, data: { lead_state: LeadState.ASSIGNED } });

      await tx.auditLog.create({
        data: {
          actor_user_id: actor.id,
          action: 'MANUAL_ASSIGN',
          entity: 'lead_assignment',
          entity_id: assignment.id,
          after: { leadId, orderId, assignmentId: assignment.id } as Prisma.InputJsonValue,
        },
      });

      return {
        leadId,
        state: LeadState.ASSIGNED,
        assignmentCount: 1,
        assignmentIds: [assignment.id],
        skipped: false,
      };
    }, TX_OPTIONS);
    this.emitAssigned(result.assignmentIds);
    return result;
  }

  /**
   * Order-centric matching for the replacement workflow: finds a fresh
   * UNSOLD_POOL lead matching the order, assigns it (stamped with
   * `replacementCode`) and consumes one balance slot. Returns the new
   * assignment, or null when the pool holds no matching lead.
   *
   * The caller runs this inside its own transaction and must already hold the
   * order's row lock. Candidate leads are locked with SKIP LOCKED so this can
   * never deadlock against the auto engine (which locks lead-then-order).
   */
  async claimReplacementLead(
    tx: TxClient,
    order: Order,
    replacementCode: string,
  ): Promise<LeadAssignment | null> {
    const candidates = await tx.lead.findMany({
      where: { lead_type: order.lead_type, lead_state: LeadState.UNSOLD_POOL },
      orderBy: { captured_at: 'desc' },
      take: 50,
    });

    for (const candidate of candidates) {
      if (!matchesCriteria(order.criteria, candidate)) {
        continue;
      }
      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM leads WHERE id = ${candidate.id}::uuid FOR UPDATE SKIP LOCKED`,
      );
      if (locked.length === 0) {
        continue;
      }
      const fresh = await tx.lead.findUnique({ where: { id: candidate.id } });
      if (!fresh || fresh.lead_state !== LeadState.UNSOLD_POOL) {
        continue;
      }
      const alreadyAssigned = await tx.leadAssignment.findFirst({
        where: { lead_id: fresh.id, order_id: order.id },
        select: { id: true },
      });
      if (alreadyAssigned) {
        continue;
      }

      const assignment = await tx.leadAssignment.create({
        data: {
          lead_id: fresh.id,
          order_id: order.id,
          client_id: order.client_id,
          assignment_type: AssignmentType.AUTO,
          delivery_mode: order.delivery_mode,
          delivery_status: DeliveryStatus.PENDING,
          replacement_code: replacementCode,
        },
      });

      const remaining = order.quantity_remaining - 1;
      await tx.order.update({
        where: { id: order.id },
        data: {
          quantity_remaining: { decrement: 1 },
          last_served_at: new Date(),
          status:
            remaining === 0
              ? OrderStatus.COMPLETED
              : order.status === OrderStatus.ACTIVE
                ? OrderStatus.FULFILLING
                : order.status,
        },
      });
      await tx.lead.update({
        where: { id: fresh.id },
        data: { lead_state: LeadState.ASSIGNED },
      });
      return assignment;
    }
    return null;
  }

  /** Pauses a single order — it drops out of the eligible set. */
  async pauseOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.FULFILLING) {
      throw new ConflictException(`Only ACTIVE/FULFILLING orders can be paused (status ${order.status})`);
    }
    return this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAUSED } });
  }

  /** Resumes a paused order. */
  async resumeOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PAUSED) {
      throw new ConflictException(`Order is not paused (status ${order.status})`);
    }
    const status =
      order.quantity_remaining < order.quantity_paid ? OrderStatus.FULFILLING : OrderStatus.ACTIVE;
    return this.prisma.order.update({ where: { id: orderId }, data: { status } });
  }
}
