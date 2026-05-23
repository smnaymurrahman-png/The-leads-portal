import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClientsModule } from './clients/clients.module';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { DistributionModule } from './distribution/distribution.module';
import { HealthModule } from './health/health.module';
import { IntakeModule } from './intake/intake.module';
import { LandingPagesModule } from './landing-pages/landing-pages.module';
import { LeadsModule } from './leads/leads.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PricingModule } from './pricing/pricing.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReplacementsModule } from './replacements/replacements.module';
import { RevenueModule } from './revenue/revenue.module';
import { UsersModule } from './users/users.module';

/**
 * Root module. Each business domain is wired in as its own feature module:
 *   Phase 2 — AuthModule (auth + RBAC), DashboardModule (role-scoped endpoints)
 *   Phase 3 — UsersModule, ClientsModule, CampaignsModule, LandingPagesModule,
 *             PricingModule (core management)
 *   Phase 4 — IntakeModule (signed lead webhook)
 *   Phase 5 — OrdersModule, PaymentsModule (order lifecycle + Stripe)
 *   Phase 6 — DistributionModule (the lead distribution engine)
 *   Phase 7 — RealtimeModule (Socket.IO delivery), LeadsModule
 *   Phase 8 — ReplacementsModule (replacement workflow)
 *   Phase 9 — RevenueModule (revenue + KPI reporting), AuditModule
 *   Phase 10 — ApiKeysModule (encrypted secrets), ThrottlerModule (rate limit)
 *
 * AuthModule registers the global JwtAuthGuard + RolesGuard.
 * EventEmitterModule lets payments emit order events for the realtime phase.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    // Rate-limit storage + the "default" throttler (120 req/min). Specific
    // controllers (auth, intake) tighten this with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    UsersModule,
    ClientsModule,
    CampaignsModule,
    LandingPagesModule,
    PricingModule,
    IntakeModule,
    OrdersModule,
    PaymentsModule,
    DistributionModule,
    RealtimeModule,
    LeadsModule,
    ReplacementsModule,
    AuditModule,
    RevenueModule,
    ApiKeysModule,
  ],
})
export class AppModule {}
