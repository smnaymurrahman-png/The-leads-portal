import { ForbiddenException, Injectable } from '@nestjs/common';
import { type Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPrincipal } from './types';

/**
 * Reusable ownership / data-scoping helper.
 *
 *   SUPER_ADMIN · ADMIN  — unrestricted
 *   AGENT                — limited to clients they own (clients.agent_id == agent.id)
 *                          and to orders placed by those clients
 *   CLIENT               — limited to their own client record and orders
 *
 * Inject this in any service/controller and either:
 *   - spread `clientScope()` / `orderScope()` into a Prisma `where`, or
 *   - call `assertCanAccessClient()` before acting on a specific record.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prisma `where` fragment scoping a `client` query to the principal. */
  clientScope(principal: AuthPrincipal): Prisma.ClientWhereInput {
    switch (principal.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN:
        return {};
      case Role.AGENT:
        return { agent_id: principal.id };
      case Role.CLIENT:
        return { id: principal.id };
      default:
        return { id: '00000000-0000-0000-0000-000000000000' };
    }
  }

  /** Prisma `where` fragment scoping an `order` query to the principal. */
  orderScope(principal: AuthPrincipal): Prisma.OrderWhereInput {
    switch (principal.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN:
        return {};
      case Role.AGENT:
        return { client: { agent_id: principal.id } };
      case Role.CLIENT:
        return { client_id: principal.id };
      default:
        return { id: '00000000-0000-0000-0000-000000000000' };
    }
  }

  /** Throws `ForbiddenException` unless the principal may access `clientId`. */
  async assertCanAccessClient(principal: AuthPrincipal, clientId: string): Promise<void> {
    const match = await this.prisma.client.findFirst({
      where: { id: clientId, ...this.clientScope(principal) },
      select: { id: true },
    });
    if (!match) {
      throw new ForbiddenException('You do not have access to this client');
    }
  }

  /** Throws `ForbiddenException` unless the principal may access `orderId`. */
  async assertCanAccessOrder(principal: AuthPrincipal, orderId: string): Promise<void> {
    const match = await this.prisma.order.findFirst({
      where: { id: orderId, ...this.orderScope(principal) },
      select: { id: true },
    });
    if (!match) {
      throw new ForbiddenException('You do not have access to this order');
    }
  }
}
