import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal } from '../types';

/** Injects the authenticated principal: `me(@CurrentUser() user: AuthPrincipal)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal =>
    ctx.switchToHttp().getRequest<{ user: AuthPrincipal }>().user,
);
