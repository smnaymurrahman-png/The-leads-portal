import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';

/** Read access to a client's own transactions — backs the Billing screen. */
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mine')
  @Roles(Role.CLIENT)
  async mine(@CurrentUser() actor: AuthPrincipal) {
    return this.prisma.transaction.findMany({
      where: { client_id: actor.id },
      orderBy: { created_at: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            public_order_id: true,
            lead_type: true,
            delivery_mode: true,
          },
        },
      },
    });
  }
}
