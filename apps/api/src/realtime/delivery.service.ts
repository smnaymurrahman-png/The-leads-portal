import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeliveryStatus, type Prisma } from '@prisma/client';
import { LEAD_ASSIGNED, type LeadAssignedEvent } from '../events/realtime-events';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

/** Delivery is retried this many times before being marked FAILED. */
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

type AssignmentWithRelations = Prisma.LeadAssignmentGetPayload<{
  include: { lead: true; order: true };
}>;

/**
 * Pushes assigned leads to the buying client over the socket and confirms
 * delivery. Revenue is booked ONLY once the client acknowledges receipt;
 * failed deliveries are retried, then marked FAILED.
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
   * Attempts one delivery of an assignment. On success: DELIVERED + revenue
   * booked. On failure: RETRYING (and reschedule) or FAILED after the cap.
   * Never throws — it is a background worker.
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
      // DELIVERED and FAILED are terminal.
      if (
        assignment.delivery_status === DeliveryStatus.DELIVERED ||
        assignment.delivery_status === DeliveryStatus.FAILED
      ) {
        return;
      }

      const acked = await this.gateway.deliverWithAck(
        assignment.client_id,
        'lead.delivered',
        this.buildPayload(assignment),
      );

      if (acked) {
        await this.markDelivered(assignment);
        return;
      }
      await this.markFailureOrRetry(assignment);
    } catch (error) {
      this.logger.error(`Delivery of assignment ${assignmentId} errored`, error as Error);
    }
  }

  /** Delivery confirmed → DELIVERED and, only now, book the revenue. */
  private async markDelivered(assignment: AssignmentWithRelations): Promise<void> {
    await this.prisma.leadAssignment.update({
      where: { id: assignment.id },
      data: {
        delivery_status: DeliveryStatus.DELIVERED,
        delivered_at: new Date(),
        revenue: assignment.order.unit_price, // revenue booked on confirmed delivery
      },
    });
    this.logger.log(
      `Assignment ${assignment.id} delivered to client ${assignment.client_id} — revenue booked`,
    );
  }

  private async markFailureOrRetry(assignment: AssignmentWithRelations): Promise<void> {
    const attempts = assignment.delivery_attempts + 1;

    if (attempts >= MAX_DELIVERY_ATTEMPTS) {
      await this.prisma.leadAssignment.update({
        where: { id: assignment.id },
        data: { delivery_status: DeliveryStatus.FAILED, delivery_attempts: attempts },
      });
      this.logger.warn(`Assignment ${assignment.id} delivery FAILED after ${attempts} attempts`);
      return;
    }

    await this.prisma.leadAssignment.update({
      where: { id: assignment.id },
      data: { delivery_status: DeliveryStatus.RETRYING, delivery_attempts: attempts },
    });
    this.logger.warn(
      `Assignment ${assignment.id} delivery attempt ${attempts} failed — retrying in ${RETRY_DELAY_MS}ms`,
    );
    // unref() so a pending retry never keeps the process alive on its own.
    const timer = setTimeout(() => void this.deliverAssignment(assignment.id), RETRY_DELAY_MS);
    timer.unref();
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
