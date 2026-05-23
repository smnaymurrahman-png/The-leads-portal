import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { LeadsService } from './leads.service';

/** Read access to a client's own delivered/assigned leads. */
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get('mine')
  @Roles(Role.CLIENT)
  mine(@CurrentUser() actor: AuthPrincipal) {
    return this.leads.listForClient(actor.id);
  }
}
