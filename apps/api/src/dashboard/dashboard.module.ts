import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';

/** Role-scoped summary endpoints. Imports AuthModule for `OwnershipService`. */
@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
