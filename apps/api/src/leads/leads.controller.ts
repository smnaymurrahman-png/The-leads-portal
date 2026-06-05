import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { LeadState, LeadType, Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthPrincipal } from '../auth/types';
import { LeadSheetService } from './lead-sheet.service';
import { LeadsService } from './leads.service';

/** Read access to leads. CLIENT sees only their own; staff browse everything. */
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly sheetSvc: LeadSheetService,
  ) {}

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

  /**
   * Sheet view — role-scoped page of rows for a single LeadType, with sensitive
   * cells already masked. Designed to back the `LeadsSheet` React component.
   */
  @Get('sheet')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  sheet(
    @CurrentUser() actor: AuthPrincipal,
    @Query('lead_type') leadType?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: string,
  ) {
    const lt = requireLeadType(leadType);
    return this.sheetSvc.sheet(actor, lt, {
      cursor: cursor || undefined,
      limit: limit ? Number(limit) : undefined,
      state: state || undefined,
    });
  }

  /** CSV export of the sheet — same scoping + masking as the JSON view. */
  @Get('export')
  @Roles(Role.CLIENT, Role.AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @CurrentUser() actor: AuthPrincipal,
    @Query('lead_type') leadType: string | undefined,
    @Res() res: Response,
    @Query('state') state?: string,
  ): Promise<void> {
    const lt = requireLeadType(leadType);
    const csv = await this.sheetSvc.exportCsv(actor, lt, state || undefined);
    const filename = `leads-${lt.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /** Full lead detail — staff only. Includes assignments and raw payload. */
  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.detail(id);
  }
}

function requireLeadType(value: string | undefined): LeadType {
  const lt = (value ?? '').toUpperCase();
  if (!Object.values(LeadType).includes(lt as LeadType)) {
    throw new BadRequestException(
      `lead_type must be one of ${Object.values(LeadType).join(', ')}`,
    );
  }
  return lt as LeadType;
}
