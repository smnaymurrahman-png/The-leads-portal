import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AccountStatus, Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPrincipal, JwtPayload } from './types';

/**
 * Verifies the JWT signature/expiry, then re-loads the principal from the
 * database so a deleted or suspended account is rejected immediately.
 * The returned object becomes `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthPrincipal> {
    if (payload.role === Role.CLIENT) {
      const client = await this.prisma.client.findUnique({ where: { id: payload.sub } });
      if (!client || client.status !== AccountStatus.ACTIVE) {
        throw new UnauthorizedException('Account not found or inactive');
      }
      return {
        id: client.id,
        role: Role.CLIENT,
        scopeId: client.id,
        name: client.full_name,
        email: client.email,
        kind: 'CLIENT',
      };
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Account not found or inactive');
    }
    return {
      id: user.id,
      role: user.role,
      scopeId: user.id,
      name: user.full_name,
      email: user.work_email,
      kind: 'USER',
    };
  }
}
