/**
 * Standalone database connectivity check.
 *
 *   pnpm --filter @leads-portal/api db:check
 *
 * Connects with the configured DATABASE_URL, runs a trivial query, and exits
 * non-zero on failure. Useful for verifying Railway Postgres before booting
 * the full API.
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('✖ DATABASE_URL is not set. Create apps/api/.env from .env.example.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    if (result[0]?.ok === 1) {
      console.log('✔ Database connection OK');
    } else {
      console.error('✖ Unexpected query result:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('✖ Database connection failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
