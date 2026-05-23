import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OwnershipService } from '../auth/ownership.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';

/** Trims a principal down to what is safe to echo back in a response. */
function viewer(user: AuthPrincipal) {
  return { id: user.id, name: user.name, role: user.role, email: user.email };
}

/**
 * Role-scoped summary endpoints — one per dashboard area. They exist so each
 * role has an API route only it can reach; `RolesGuard` rejects everyone else
 * with `403 Forbidden`.
 */
@Controller()
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get('super-admin/summary')
  @Roles(Role.SUPER_ADMIN)
  async superAdmin(@CurrentUser() user: AuthPrincipal) {
    const [users, clients, orders] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.client.count(),
      this.prisma.order.count(),
    ]);
    return { scope: 'SUPER_ADMIN', viewer: viewer(user), totals: { users, clients, orders } };
  }

  @Get('admin/summary')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async admin(@CurrentUser() user: AuthPrincipal) {
    const [clients, campaigns] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.campaign.count(),
    ]);
    return { scope: 'ADMIN', viewer: viewer(user), totals: { clients, campaigns } };
  }

  @Get('agent/summary')
  @Roles(Role.AGENT)
  async agent(@CurrentUser() user: AuthPrincipal) {
    // Ownership scoping in action: an AGENT only counts the clients they own.
    const myClients = await this.prisma.client.count({
      where: this.ownership.clientScope(user),
    });
    return { scope: 'AGENT', viewer: viewer(user), totals: { myClients } };
  }

  @Get('client/summary')
  @Roles(Role.CLIENT)
  async client(@CurrentUser() user: AuthPrincipal) {
    const myOrders = await this.prisma.order.count({
      where: this.ownership.orderScope(user),
    });
    return { scope: 'CLIENT', viewer: viewer(user), totals: { myOrders } };
  }
}
