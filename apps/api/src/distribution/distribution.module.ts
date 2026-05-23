import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DistributionControlsService } from './distribution-controls.service';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';

/**
 * The Lead Distribution Engine. `DistributionService` listens for the
 * `lead.valid` event (emitted by intake) and also exposes the manual path.
 */
@Module({
  imports: [AuditModule],
  controllers: [DistributionController],
  providers: [DistributionService, DistributionControlsService],
  exports: [DistributionService],
})
export class DistributionModule {}
