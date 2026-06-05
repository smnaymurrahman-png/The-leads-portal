import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeliveryStatus, LeadState, type Prisma } from '@prisma/client';
import { LEAD_ASSIGNED, type LeadAssignedEvent } from '../events/realtime-events';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

type AssignmentWithRelations = Prisma.LeadAssignmentGetPayload<{
  include: { lead: true; order: true };
}>;

/**
 * Books delivery for assigned leads.
 *
 * A lead assigned to a buying client IS delivered to their account — it shows
 * up in their My Leads feed and CRM export immediately. So delivery is recorded
 * (and revenue booked) the moment the distribution engine commits an
 * assignment; the Socket.IO push is a best-effort *real-time notification* on
 * top of that, NOT a precondition. (Previously delivery depended on the client's
 * browser acknowledging a socket push within 5s, so any lead assigned while the
 * client was offline was wrongly marked FAILED and never booked revenue.)
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  /** Triggered after the distribution engine commits a new assignment. */
  @OnEvent(LEAD_ASSIGNED)
  async onLeadAssigned(event: LeadAssignedEvent): Promise<void> {
    await this.deliverAssignment(event.assignmentId);
  }

  /**
   * Records delivery for an assignment: DELIVERED + delivered_at + revenue, and
   * advances the lead lifecycle. Then pushes a best-effort real-time event to
   * the client's live feed. Never throws — it's a background worker.
   */
  async deliverAssignment(assignmentId: string): Promise<void> {
    try {
      const assignment = await this.prisma.leadAssignment.findUnique({
        where: { id: assignmentId },
        include: { lead: true, order: true },
      });
      if (!assignment) {
        return;
      }
      if (assignment.delivery_status === DeliveryStatus.DELIVERED) {
        return; // already booked — idempotent
      }

      await this.markDelivered(assignment);

      // Best-effort live push (live feed + notification bell). If the client is
      // offline it simply isn't shown in real time — the lead is already in
      // their account and will appear the next time they load My Leads.
      this.gateway.emitToPrincipal(
        assignment.client_id,
        'lead.delivered',
        this.buildPayload(assignment),
      );

      this.logger.log(
        `Assignment ${assignment.id} delivered to client ${assignment.client_id} — revenue booked`,
      );
    } catch (error) {
      this.logger.error(`Delivery of assignment ${assignmentId} errored`, error as Error);
    }
  }

  /** Marks the assignment delivered, books revenue, and advances the lead. */
  private async markDelivered(assignment: AssignmentWithRelations): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.leadAssignment.update({
        where: { id: assignment.id },
        data: {
          delivery_status: DeliveryStatus.DELIVERED,
          delivered_at: new Date(),
          revenue: assignment.order.unit_price, // revenue booked on delivery
        },
      }),
      // Advance the lead lifecycle, but only from ASSIGNED so we never clobber a
      // REPLACEMENT_REQUESTED / REPLACED / ACCEPTED state set elsewhere.
      this.prisma.lead.updateMany({
        where: { id: assignment.lead_id, lead_state: LeadState.ASSIGNED },
        data: { lead_state: LeadState.DELIVERED },
      }),
    ]);
  }

  /** The lead payload pushed to the client's live feed. */
  private buildPayload(assignment: AssignmentWithRelations) {
    const { lead } = assignment;
    return {
      assignmentId: assignment.id,
      orderId: assignment.order_id,
      leadId: lead.id,
      publicLeadId: lead.public_lead_id,
      leadType: lead.lead_type,
      fullName: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      state: lead.state,
      zip: lead.zip,
      qualification: lead.qualification,
      capturedAt: lead.captured_at,
      createdAt: assignment.created_at,
      deliveryStatus: DeliveryStatus.DELIVERED,
    };
  }
}
