import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Role } from '@prisma/client';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignSampleDto } from './dto/assign-sample.dto';
import type { CreateSampleRequestDto } from './dto/create-sample-request.dto';
import type { RejectSampleDto } from './dto/reject-sample.dto';

@Injectable()
export class SamplesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Pool management (admin/super-admin) ──────────────────────────────────

  async listPool() {
    return this.prisma.lead.findMany({
      where: { in_sample_pool: true },
      orderBy: { captured_at: 'desc' },
      take: 500,
      select: {
        id: true,
        public_lead_id: true,
        lead_type: true,
        lead_state: true,
        full_name: true,
        email: true,
        phone: true,
        state: true,
        zip: true,
        captured_at: true,
        in_sample_pool: true,
      },
    });
  }

  async addToPool(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.lead.update({
      where: { id: leadId },
      data: { in_sample_pool: true },
      select: { id: true, public_lead_id: true, in_sample_pool: true },
    });
  }

  async removeFromPool(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.lead.update({
      where: { id: leadId },
      data: { in_sample_pool: false },
      select: { id: true, public_lead_id: true, in_sample_pool: true },
    });
  }

  // ── Sample requests ───────────────────────────────────────────────────────

  async createRequest(actor: AuthPrincipal, dto: CreateSampleRequestDto) {
    const client = await this.prisma.client.findUnique({ where: { id: actor.scopeId } });
    if (!client) throw new NotFoundException('Client not found');
    return this.prisma.sampleRequest.create({
      data: {
        public_id: `SMP-${randomBytes(5).toString('hex').toUpperCase()}`,
        client_id: client.id,
        agent_id: client.agent_id,
        lead_type: dto.lead_type,
        quantity: dto.quantity,
        delivery_mode: dto.delivery_mode,
        state_filter: dto.state_filter,
        zip_filter: dto.zip_filter,
        notes: dto.notes,
      },
      include: this.includeDetail(),
    });
  }

  async listRequests(actor: AuthPrincipal) {
    const where =
      actor.role === Role.CLIENT
        ? { client_id: actor.scopeId }
        : actor.role === Role.AGENT
          ? { agent_id: actor.id }
          : {};
    return this.prisma.sampleRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: this.includeDetail(),
    });
  }

  async getRequest(actor: AuthPrincipal, id: string) {
    const req = await this.prisma.sampleRequest.findUnique({
      where: { id },
      include: { ...this.includeDetail(), deliveries: { include: { lead: true, client: true } } },
    });
    if (!req) throw new NotFoundException('Sample request not found');
    this.assertAccess(actor, req);
    return req;
  }

  async forwardToAdmin(actor: AuthPrincipal, id: string) {
    const req = await this.findOrFail(id);
    if (actor.role !== Role.AGENT || req.agent_id !== actor.id) {
      throw new ForbiddenException('Only the owning agent can forward this request');
    }
    if (req.status !== 'PENDING') throw new BadRequestException('Request is not pending');
    return this.prisma.sampleRequest.update({
      where: { id },
      data: { status: 'FORWARDED' },
      include: this.includeDetail(),
    });
  }

  async rejectRequest(actor: AuthPrincipal, id: string, dto: RejectSampleDto) {
    const req = await this.findOrFail(id);
    if (!['PENDING', 'FORWARDED'].includes(req.status)) {
      throw new BadRequestException('Request cannot be rejected in its current state');
    }
    return this.prisma.sampleRequest.update({
      where: { id },
      data: { status: 'REJECTED', reject_reason: dto.reason, reviewed_by: actor.id },
      include: this.includeDetail(),
    });
  }

  async assignLeads(actor: AuthPrincipal, id: string, dto: AssignSampleDto) {
    const req = await this.findOrFail(id);
    if (req.status === 'REJECTED') throw new BadRequestException('Request is already rejected');
    if (dto.lead_ids.length > req.quantity) {
      throw new BadRequestException(`Cannot assign more than ${req.quantity} leads`);
    }

    // Admin assigns to client_id; agent can only assign to their own client
    const targetClientId = dto.client_id ?? req.client_id;
    if (actor.role === Role.AGENT) {
      // verify client belongs to this agent
      const client = await this.prisma.client.findUnique({ where: { id: targetClientId } });
      if (!client || client.agent_id !== actor.id) {
        throw new ForbiddenException('You can only assign to your own clients');
      }
    }

    // Verify leads are in pool and match lead_type
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: dto.lead_ids }, in_sample_pool: true, lead_type: req.lead_type },
    });
    if (leads.length !== dto.lead_ids.length) {
      throw new BadRequestException('Some leads are not in the sample pool or wrong type');
    }

    await this.prisma.$transaction([
      ...dto.lead_ids.map((leadId) =>
        this.prisma.sampleDelivery.upsert({
          where: { sample_request_id_lead_id: { sample_request_id: id, lead_id: leadId } },
          update: { client_id: targetClientId, assigned_by: actor.id },
          create: {
            sample_request_id: id,
            lead_id: leadId,
            client_id: targetClientId,
            assigned_by: actor.id,
          },
        }),
      ),
      this.prisma.sampleRequest.update({
        where: { id },
        data: { status: 'ASSIGNED', reviewed_by: actor.id },
      }),
    ]);

    return this.getRequest(actor, id);
  }

  // ── Client sample leads (sheet-style) ────────────────────────────────────

  async listClientSampleLeads(actor: AuthPrincipal) {
    const deliveries = await this.prisma.sampleDelivery.findMany({
      where: { client_id: actor.scopeId },
      include: { lead: true, sample_request: { select: { public_id: true, lead_type: true } } },
      orderBy: { created_at: 'desc' },
    });
    return deliveries.map((d) => ({
      deliveryId: d.id,
      requestPublicId: d.sample_request.public_id,
      leadId: d.lead.id,
      publicLeadId: d.lead.public_lead_id,
      leadType: d.lead.lead_type,
      fullName: d.lead.full_name,
      email: d.lead.email,
      phone: d.lead.phone,
      state: d.lead.state,
      zip: d.lead.zip,
      capturedAt: d.lead.captured_at,
      receivedAt: d.created_at,
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private includeDetail() {
    return {
      client: { select: { id: true, full_name: true, business_name: true, email: true } },
      agent: { select: { id: true, full_name: true, work_email: true } },
      reviewer: { select: { id: true, full_name: true } },
      _count: { select: { deliveries: true } },
    } as const;
  }

  private async findOrFail(id: string) {
    const req = await this.prisma.sampleRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Sample request not found');
    return req;
  }

  private assertAccess(actor: AuthPrincipal, req: { client_id: string; agent_id: string }) {
    if (actor.role === Role.CLIENT && req.client_id !== actor.scopeId) {
      throw new ForbiddenException();
    }
    if (actor.role === Role.AGENT && req.agent_id !== actor.id) {
      throw new ForbiddenException();
    }
  }
}
