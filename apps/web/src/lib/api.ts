import type { HealthStatus } from '@leads-portal/shared';

/** Base URL of the NestJS API, including its `/api` global prefix. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * Fetches the API readiness status. Returns an `error` HealthStatus instead of
 * throwing so the page can always render something meaningful.
 */
export async function fetchApiHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`API responded ${res.status}`);
    }
    return (await res.json()) as HealthStatus;
  } catch (error) {
    return {
      status: 'error',
      service: 'leads-portal-api',
      timestamp: new Date().toISOString(),
      checks: { reachable: 'error' },
    };
  }
}
