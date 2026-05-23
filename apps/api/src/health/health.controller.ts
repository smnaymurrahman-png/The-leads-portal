import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import type { HealthStatus } from '@leads-portal/shared';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

/**
 * Public, unauthenticated health endpoints.
 *
 *   GET /api/health        — readiness (process + database)
 *   GET /api/health/live   — liveness (process only)
 *
 * Used by local verification, Railway, and uptime monitors.
 * `@Public()` exempts the whole controller from the global JwtAuthGuard.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  readiness(): Promise<HealthStatus> {
    return this.health.readiness();
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  liveness(): HealthStatus {
    return this.health.liveness();
  }
}
