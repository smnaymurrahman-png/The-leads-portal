import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@leads-portal/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Aggregates the health of the API and its dependencies.
 */
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness only — confirms the process is up and serving requests. */
  liveness(): HealthStatus {
    return {
      status: 'ok',
      service: 'leads-portal-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness — confirms the API plus every downstream dependency is usable. */
  async readiness(): Promise<HealthStatus> {
    const dbOk = await this.prisma.isHealthy();

    return {
      status: dbOk ? 'ok' : 'degraded',
      service: 'leads-portal-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'error',
      },
    };
  }
}
