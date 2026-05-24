import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { LeadState, LeadType, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { LeadsService } from './leads.service';

/** Read access to leads. CLIENT sees only their own; staff browse everything. */
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /** Staff index — all leads with assignment summary and optional filters. */
  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  list(
    @Query('lead_type') leadType?: string,
    @Query('state') state?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leads.listAll({
      leadType: leadType as LeadType | undefined,
      state: state as LeadState | undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** A buying client's own delivered/assigned leads — backs the live feed. */
  @Get('mine')
  @Roles(Role.CLIENT)
  mine(@CurrentUser() actor: AuthPrincipal) {
    return this.leads.listForClient(actor.id);
  }

  /** Full lead detail — staff only. Includes assignments and raw payload. */
  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.detail(id);
  }
}
