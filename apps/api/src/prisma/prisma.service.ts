import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around the generated Prisma client.
 *
 * It is the single entry point for database access across the API. The
 * connection is opened when the Nest module initialises and closed cleanly on
 * shutdown so Railway/Postgres connection slots are not leaked.
 *
 * A failed connection at startup is logged but does NOT abort the process:
 * the API still boots and `/api/health` reports a `degraded` status until the
 * database becomes reachable. This keeps the scaffold runnable before
 * `DATABASE_URL` points at a real Railway database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL');
    } catch (error) {
      this.logger.warn(
        `Could not connect to PostgreSQL at startup — API is running in a degraded ` +
          `state. Set a valid DATABASE_URL and restart. (${(error as Error).message})`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }

  /**
   * Lightweight connectivity probe used by the health endpoint.
   * Returns true when a trivial query succeeds.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error as Error);
      return false;
    }
  }
}
