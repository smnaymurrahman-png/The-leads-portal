import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LeadAssignmentsController } from './lead-assignments.controller';
import { LeadSheetService } from './lead-sheet.service';
import { LeadTypeColumnsController } from './lead-type-columns.controller';
import { LeadTypeColumnsService } from './lead-type-columns.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [LeadsController, LeadTypeColumnsController, LeadAssignmentsController],
  providers: [LeadsService, LeadSheetService, LeadTypeColumnsService],
  exports: [LeadsService, LeadSheetService],
})
export class LeadsModule {}
