import { Role } from '@leads-portal/shared';
import { jwtVerify } from 'jose';

/**
 * Server-only auth helpers. Do NOT import this from a Client Component —
 * `verifyToken` needs `JWT_SECRET`, which must never reach the browser.
 */

/** Name of the httpOnly cookie that holds the JWT access token. */
export const COOKIE_NAME = 'access_token';

/** Landing route for each role — also the root of that role's route group. */
export const ROLE_HOME: Record<Role, string> = {
  [Role.SUPER_ADMIN]: '/super-admin',
  [Role.ADMIN]: '/admin',
  [Role.AGENT]: '/agent',
  [Role.CLIENT]: '/client',
};

/** Verified token claims — mirrors the API's JWT payload. */
export interface SessionClaims {
  sub: string;
  role: Role;
  scopeId: string;
}

function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set — it must match the API.');
  }
  return new TextEncoder().encode(secret);
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLE_HOME, value);
}

/** Verifies a JWT's signature and expiry. Returns null when invalid. */
export async function verifyToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (typeof payload.sub !== 'string' || !isRole(payload.role)) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
      scopeId: typeof payload.scopeId === 'string' ? payload.scopeId : payload.sub,
    };
  } catch {
    return null;
  }
}
