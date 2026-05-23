import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { OwnershipService } from '../auth/ownership.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';

const HIDE_HASH = { password_hash: true } as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async create(actor: AuthPrincipal, dto: CreateClientDto) {
    // An AGENT always owns the clients they create; staff must name the agent.
    const agent_id =
      actor.role === Role.AGENT ? actor.id : await this.resolveAgentId(dto.agent_id);

    const email = dto.email.trim().toLowerCase();
    const clash = await this.prisma.client.findUnique({ where: { email } });
    if (clash) {
      throw new ConflictException('A client with this email already exists');
    }

    return this.prisma.client.create({
      data: {
        agent_id,
        full_name: dto.full_name,
        email,
        password_hash: await hash(dto.password, 10),
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        business_name: dto.business_name,
        address: dto.address,
      },
      omit: HIDE_HASH,
    });
  }

  /** AGENT sees only their own clients; ADMIN/SUPER_ADMIN see all. */
  list(actor: AuthPrincipal) {
    return this.prisma.client.findMany({
      where: this.ownership.clientScope(actor),
      omit: HIDE_HASH,
      orderBy: { created_at: 'desc' },
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    // 403 if the client exists but is owned by another agent.
    await this.ownership.assertCanAccessClient(actor, id);
    const client = await this.prisma.client.findUnique({ where: { id }, omit: HIDE_HASH });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateClientDto) {
    await this.ownership.assertCanAccessClient(actor, id);
    if (dto.agent_id !== undefined && actor.role === Role.AGENT) {
      throw new ForbiddenException('Agents cannot reassign client ownership');
    }
    if (dto.agent_id) {
      await this.resolveAgentId(dto.agent_id);
    }
    return this.prisma.client.update({ where: { id }, data: dto, omit: HIDE_HASH });
  }

  /** Validates that `agent_id` is provided and references a real AGENT user. */
  private async resolveAgentId(agent_id?: string): Promise<string> {
    if (!agent_id) {
      throw new BadRequestException('agent_id is required');
    }
    const agent = await this.prisma.user.findUnique({ where: { id: agent_id } });
    if (!agent || agent.role !== Role.AGENT) {
      throw new BadRequestException('agent_id must reference an AGENT user');
    }
    return agent.id;
  }
}
