import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route (or controller) to the given roles. Routes with no
 * `@Roles(...)` are reachable by any authenticated principal.
 *
 *   @Roles(Role.SUPER_ADMIN, Role.ADMIN)
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
