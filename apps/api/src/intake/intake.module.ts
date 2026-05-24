import { Module } from '@nestjs/common';
import { BulkImportController } from './bulk-import.controller';
import { DeliverabilityService } from './deliverability.service';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  controllers: [IntakeController, BulkImportController],
  providers: [IntakeService, DeliverabilityService],
})
export class IntakeModule {}
