import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A buying client's leads — their assignments joined with lead detail.
   * Shape matches the `lead.delivered` socket payload so the live feed can
   * merge realtime and historical items uniformly.
   */
  async listForClient(clientId: string) {
    const assignments = await this.prisma.leadAssignment.findMany({
      where: { client_id: clientId },
      include: { lead: true },
      orderBy: { created_at: 'desc' },
    });
    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      orderId: assignment.order_id,
      leadId: assignment.lead.id,
      publicLeadId: assignment.lead.public_lead_id,
      leadType: assignment.lead.lead_type,
      fullName: assignment.lead.full_name,
      email: assignment.lead.email,
      phone: assignment.lead.phone,
      state: assignment.lead.state,
      zip: assignment.lead.zip,
      qualification: assignment.lead.qualification,
      capturedAt: assignment.lead.captured_at,
      createdAt: assignment.created_at,
      deliveryStatus: assignment.delivery_status,
      deliveredAt: assignment.delivered_at,
    }));
  }
}
