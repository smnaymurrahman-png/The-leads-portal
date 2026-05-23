/**
 * The four roles of the Leads Portal, in strict descending authority.
 *
 *   SUPER_ADMIN > ADMIN > AGENT > CLIENT
 *
 * This enum is the single source of truth shared by the backend RBAC guards
 * (Phase 2) and the frontend role-based dashboards (Phase 7).
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  CLIENT = 'CLIENT',
}

/**
 * Numeric authority level for each role. Higher means more authority.
 * Useful for "at least this role" checks (e.g. ADMIN endpoints also allow
 * SUPER_ADMIN). Never use this to bypass per-resource ownership scoping.
 */
export const ROLE_RANK: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 40,
  [Role.ADMIN]: 30,
  [Role.AGENT]: 20,
  [Role.CLIENT]: 10,
};

/** Roles ordered from highest to lowest authority. */
export const ROLE_HIERARCHY: readonly Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.AGENT,
  Role.CLIENT,
];

/** True when `role` has at least the authority of `minimum`. */
export function hasAtLeastRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
