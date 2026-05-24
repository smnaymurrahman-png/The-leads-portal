import { Injectable, NotFoundException } from '@nestjs/common';
import type { LeadState, LeadType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Staff index — every lead with its capture metadata, current state and a
   * compact "latest assignment" summary. Most-recent first. Optional filters
   * narrow by type/state for the new Leads screen.
   */
  async listAll(filter: { leadType?: LeadType; state?: LeadState; limit?: number } = {}) {
    const leads = await this.prisma.lead.findMany({
      where: {
        lead_type: filter.leadType,
        lead_state: filter.state,
      },
      orderBy: { captured_at: 'desc' },
      take: Math.min(filter.limit ?? 200, 500),
      include: {
        landing_page: { select: { id: true, name: true } },
        assignments: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            client: { select: { id: true, full_name: true, business_name: true } },
            order: { select: { id: true, public_order_id: true } },
          },
        },
        _count: { select: { assignments: true } },
      },
    });
    return leads.map((lead) => {
      const assignment = lead.assignments[0];
      return {
        id: lead.id,
        publicLeadId: lead.public_lead_id,
        leadType: lead.lead_type,
        state: lead.lead_state,
        rejectReason: lead.reject_reason,
        capturedAt: lead.captured_at,
        fullName: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        zip: lead.zip,
        usState: lead.state,
        landingPage: lead.landing_page
          ? { id: lead.landing_page.id, name: lead.landing_page.name }
          : null,
        assignmentCount: lead._count.assignments,
        latestAssignment: assignment
          ? {
              id: assignment.id,
              deliveryStatus: assignment.delivery_status,
              deliveredAt: assignment.delivered_at,
              client: assignment.client,
              order: assignment.order,
            }
          : null,
      };
    });
  }

  /** Full lead detail incl. raw normalized payload and every assignment. */
  async detail(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        landing_page: { select: { id: true, name: true, lead_type: true } },
        assignments: {
          orderBy: { created_at: 'desc' },
          include: {
            client: { select: { id: true, full_name: true, business_name: true } },
            order: { select: { id: true, public_order_id: true, status: true } },
          },
        },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

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
