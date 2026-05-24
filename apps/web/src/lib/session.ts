import { cookies } from 'next/headers';
import { API_URL } from './api';
import { COOKIE_NAME } from './auth';

/** Principal profile as returned by the API's `GET /auth/me`. */
export interface Session {
  id: string;
  role: string;
  name: string;
  email: string;
  scopeId: string;
  kind: string;
}

/**
 * Server-side: reads the access-token cookie and resolves the principal via
 * the API. Returns null when there is no token or the API rejects it.
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as Session;
  } catch {
    return null;
  }
}

/**
 * Server-side: GETs `<API_URL>/<path>` with the caller's bearer token from
 * cookies. Returns null on any failure so the page can render a partial
 * state instead of erroring out.
 */
export async function serverApiGet<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
