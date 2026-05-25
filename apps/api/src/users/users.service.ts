import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { AuthPrincipal } from '../auth/types';
import { deleteOrConflict } from '../common/delete-helpers';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

/** `password_hash` must never leave the API. */
const HIDE_HASH = { password_hash: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthPrincipal, dto: CreateUserDto) {
    // An ADMIN may onboard ADMIN/AGENT staff but not mint a SUPER_ADMIN.
    if (actor.role === Role.ADMIN && dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Admins cannot create super admins');
    }

    const work_email = dto.work_email.trim().toLowerCase();
    const clash = await this.prisma.user.findUnique({ where: { work_email } });
    if (clash) {
      throw new ConflictException('A user with this work email already exists');
    }

    return this.prisma.user.create({
      data: {
        role: dto.role,
        full_name: dto.full_name,
        work_email,
        password_hash: await hash(dto.password, 10),
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        designation: dto.designation,
        employee_id: dto.employee_id,
        linkedin_url: dto.linkedin_url,
      },
      omit: HIDE_HASH,
    });
  }

  list(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      omit: HIDE_HASH,
      orderBy: { created_at: 'desc' },
    });
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, omit: HIDE_HASH });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.get(id);
    return this.prisma.user.update({ where: { id }, data: dto, omit: HIDE_HASH });
  }

  async remove(actor: AuthPrincipal, id: string) {
    if (actor.id === id) {
      throw new ForbiddenException("You can't delete your own account.");
    }
    await this.get(id);
    await deleteOrConflict(() => this.prisma.user.delete({ where: { id } }), 'user');
    return { id, deleted: true };
  }
}
