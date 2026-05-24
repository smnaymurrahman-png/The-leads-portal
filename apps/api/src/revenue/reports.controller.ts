import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

/** KPI reporting + dashboards. ADMIN / SUPER_ADMIN. */
@Controller('reports')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('kpis')
  kpis() {
    return this.reports.kpis();
  }

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('leads-ledger')
  leadsLedger(@Query('limit') limit?: string) {
    return this.reports.leadsLedger(limit ? Number(limit) : undefined);
  }

  @Get('series')
  series(@Query('days') days?: string) {
    return this.reports.series(days ? Number(days) : undefined);
  }
}
