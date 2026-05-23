import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DistributionModule } from '../distribution/distribution.module';
import { ReplacementPolicyService } from './replacement-policy.service';
import { ReplacementsController } from './replacements.controller';
import { ReplacementsService } from './replacements.service';

/** Imports DistributionModule for order-centric replacement matching. */
@Module({
  imports: [DistributionModule, AuditModule],
  controllers: [ReplacementsController],
  providers: [ReplacementsService, ReplacementPolicyService],
})
export class ReplacementsModule {}
