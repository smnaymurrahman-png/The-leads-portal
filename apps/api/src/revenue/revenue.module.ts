import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

/**
 * Revenue, KPI reporting and dashboards. Exports RevenueService so the
 * payments module can read the commission rate when booking commissions.
 */
@Module({
  imports: [AuditModule],
  controllers: [RevenueController, ReportsController],
  providers: [RevenueService, ReportsService],
  exports: [RevenueService],
})
export class RevenueModule {}
