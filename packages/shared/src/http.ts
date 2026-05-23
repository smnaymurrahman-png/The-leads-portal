/**
 * Shared HTTP response shapes used across the API and web app.
 */

/** Standard payload returned by the API health endpoints. */
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  /** ISO-8601 timestamp of when the check ran. */
  timestamp: string;
  /** Per-dependency results (e.g. database connectivity). */
  checks?: Record<string, 'ok' | 'error'>;
}
