import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeliveryService } from './delivery.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeListener } from './realtime.listener';

/**
 * Real-time layer: the authenticated Socket.IO gateway, the delivery worker
 * (with retry + revenue-on-confirm), and the domain-event → socket bridge.
 * Imports AuthModule for the shared `JwtService`.
 */
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, DeliveryService, RealtimeListener],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
