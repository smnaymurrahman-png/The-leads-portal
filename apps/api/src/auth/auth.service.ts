import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { compare, hash as bcryptHash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPrincipal, JwtPayload } from './types';

export interface LoginResult {
  accessToken: string;
  principal: { id: string; role: Role; name: string; email: string };
}

/**
 * Authenticates against BOTH `users` (internal staff) and `clients` (buyers).
 * A successful login returns a signed JWT carrying `{ sub, role, scopeId }`.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const normalized = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { work_email: normalized } });
    if (user) {
      await this.verifyPassword(password, user.password_hash);
      return this.issue(user.id, user.role, user.full_name, user.work_email);
    }

    const client = await this.prisma.client.findUnique({ where: { email: normalized } });
    if (client) {
      await this.verifyPassword(password, client.password_hash);
      return this.issue(client.id, Role.CLIENT, client.full_name, client.email);
    }

    // Same error whether the email is unknown or the password is wrong.
    throw new UnauthorizedException('Invalid email or password');
  }

  private async verifyPassword(password: string, hash: string): Promise<void> {
    const ok = await compare(password, hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  private issue(id: string, role: Role, name: string, email: string): LoginResult {
    const payload: JwtPayload = { sub: id, role, scopeId: id };
    return {
      accessToken: this.jwt.sign(payload),
      principal: { id, role, name, email },
    };
  }

  /**
   * Self-service password change. Verifies the current password against the
   * principal's stored hash (User or Client depending on `kind`) and writes a
   * fresh bcrypt hash with the same cost factor used at signup.
   */
  async changePassword(
    actor: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (newPassword.length < 8) {
      throw new UnauthorizedException('New password must be at least 8 characters');
    }

    if (actor.kind === 'USER') {
      const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
      if (!user) throw new UnauthorizedException('Account not found');
      await this.verifyPassword(currentPassword, user.password_hash);
      await this.prisma.user.update({
        where: { id: actor.id },
        data: { password_hash: await bcryptHash(newPassword, 10) },
      });
      return;
    }

    const client = await this.prisma.client.findUnique({ where: { id: actor.id } });
    if (!client) throw new UnauthorizedException('Account not found');
    await this.verifyPassword(currentPassword, client.password_hash);
    await this.prisma.client.update({
      where: { id: actor.id },
      data: { password_hash: await bcryptHash(newPassword, 10) },
    });
  }
}
