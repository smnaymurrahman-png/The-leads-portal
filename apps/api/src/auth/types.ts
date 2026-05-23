import type { Role } from '@prisma/client';

/**
 * Decoded JWT payload. Kept deliberately small — `{ sub, role, scopeId }`.
 *   sub     — id of the authenticated principal (a user OR a client)
 *   role    — RBAC role (CLIENT for buyers; staff role for `users`)
 *   scopeId — root of the principal's ownership scope (equals `sub`)
 */
export interface JwtPayload {
  sub: string;
  role: Role;
  scopeId: string;
}

/** The authenticated principal attached to `request.user` by `JwtStrategy`. */
export interface AuthPrincipal {
  id: string;
  role: Role;
  scopeId: string;
  name: string;
  email: string;
  /** Which table the principal lives in. */
  kind: 'USER' | 'CLIENT';
}
