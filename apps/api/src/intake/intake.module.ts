import { Module } from '@nestjs/common';
import { DeliverabilityService } from './deliverability.service';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  controllers: [IntakeController],
  providers: [IntakeService, DeliverabilityService],
})
export class IntakeModule {}
