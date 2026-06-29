import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Role } from '@prisma/client';
import { compare, hash as bcryptHash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { SignupAgentDto } from './dto/signup-agent.dto';
import type { SignupClientDto } from './dto/signup-client.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
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
      if (user.status === AccountStatus.PENDING) {
        throw new UnauthorizedException('Your account is pending approval. You will be notified once approved.');
      }
      if (user.status !== AccountStatus.ACTIVE) {
        throw new UnauthorizedException('Your account is not active. Contact your administrator.');
      }
      return this.issue(user.id, user.role, user.full_name, user.work_email);
    }

    const client = await this.prisma.client.findUnique({ where: { email: normalized } });
    if (client) {
      await this.verifyPassword(password, client.password_hash);
      if (client.status === AccountStatus.PENDING) {
        throw new UnauthorizedException('Your account is pending approval from your agent.');
      }
      if (client.status !== AccountStatus.ACTIVE) {
        throw new UnauthorizedException('Your account is not active. Contact your agent.');
      }
      return this.issue(client.id, Role.CLIENT, client.full_name, client.email);
    }

    // Same error whether the email is unknown or the password is wrong.
    throw new UnauthorizedException('Invalid email or password');
  }

  async signupAgent(dto: SignupAgentDto): Promise<{ message: string }> {
    const email = dto.work_email.trim().toLowerCase();
    const clash = await this.prisma.user.findUnique({ where: { work_email: email } });
    if (clash) {
      throw new ConflictException('An account with this email already exists');
    }
    await this.prisma.user.create({
      data: {
        role: Role.AGENT,
        full_name: dto.full_name,
        work_email: email,
        phone: dto.phone,
        whatsapp: dto.whatsapp ?? null,
        business_name: dto.business_name ?? null,
        password_hash: await bcryptHash(dto.password, 10),
        status: AccountStatus.PENDING,
      },
    });
    return { message: 'Application submitted. An admin will review and approve your account.' };
  }

  async signupClient(dto: SignupClientDto): Promise<{ message: string }> {
    const agent = await this.prisma.user.findUnique({ where: { id: dto.agent_id } });
    if (!agent || agent.role !== Role.AGENT || agent.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Invalid agent ID. Please check with your agent.');
    }
    const email = dto.email.trim().toLowerCase();
    const clash = await this.prisma.client.findUnique({ where: { email } });
    if (clash) {
      throw new ConflictException('An account with this email already exists');
    }
    await this.prisma.client.create({
      data: {
        agent_id: dto.agent_id,
        full_name: dto.full_name,
        email,
        password_hash: await bcryptHash(dto.password, 10),
        whatsapp: dto.whatsapp ?? null,
        business_name: dto.business_name ?? null,
        address: dto.address ?? null,
        targeted_lead_type: dto.targeted_lead_type,
        status: AccountStatus.PENDING,
      },
    });
    return { message: 'Account created. Your agent will review and approve your request.' };
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

  /**
   * Full editable profile for the current principal — pulled separately
   * from `/auth/me` so the ProfileScreen can pre-fill its form without
   * making the lean me endpoint heavier on every page load.
   */
  async fullProfile(actor: AuthPrincipal) {
    if (actor.kind === 'USER') {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.id },
        omit: { password_hash: true },
      });
      if (!user) throw new UnauthorizedException('Account not found');
      return {
        kind: 'USER' as const,
        id: user.id,
        full_name: user.full_name,
        email: user.work_email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        whatsapp: user.whatsapp,
        designation: user.designation,
        employee_id: user.employee_id,
        linkedin_url: user.linkedin_url,
      };
    }
    const client = await this.prisma.client.findUnique({
      where: { id: actor.id },
      omit: { password_hash: true },
    });
    if (!client) throw new UnauthorizedException('Account not found');
    return {
      kind: 'CLIENT' as const,
      id: client.id,
      full_name: client.full_name,
      email: client.email,
      role: Role.CLIENT,
      status: client.status,
      phone: client.phone,
      whatsapp: client.whatsapp,
      business_name: client.business_name,
      address: client.address,
    };
  }

  /**
   * Self-service profile update. Writes to the principal's own row in
   * whichever table they live in. Fields that don't apply to the kind
   * (e.g. business_name on a staff user) are silently dropped so the same
   * DTO works for both. The caller's email/role/ownership/password are NOT
   * editable here — they have dedicated endpoints.
   */
  async updateProfile(actor: AuthPrincipal, dto: UpdateProfileDto) {
    if (actor.kind === 'USER') {
      const data = {
        full_name: dto.full_name,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        designation: dto.designation,
        employee_id: dto.employee_id,
        linkedin_url: dto.linkedin_url,
      };
      const updated = await this.prisma.user.update({
        where: { id: actor.id },
        data: prune(data),
        omit: { password_hash: true },
      });
      return {
        id: updated.id,
        role: updated.role,
        name: updated.full_name,
        email: updated.work_email,
        scopeId: updated.id,
        kind: 'USER' as const,
      };
    }

    const data = {
      full_name: dto.full_name,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      business_name: dto.business_name,
      address: dto.address,
    };
    const updated = await this.prisma.client.update({
      where: { id: actor.id },
      data: prune(data),
      omit: { password_hash: true },
    });
    return {
      id: updated.id,
      role: Role.CLIENT,
      name: updated.full_name,
      email: updated.email,
      scopeId: updated.id,
      kind: 'CLIENT' as const,
    };
  }
}

/** Drop keys whose value is undefined so Prisma doesn't blank them out. */
function prune<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
