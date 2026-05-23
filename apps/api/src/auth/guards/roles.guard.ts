import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthPrincipal } from '../types';

/**
 * Global RBAC guard. Runs after `JwtAuthGuard`. A route opts in to role
 * restriction with `@Roles(...)`; routes without it allow any authenticated
 * principal.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this resource');
    }
    return true;
  }
}
