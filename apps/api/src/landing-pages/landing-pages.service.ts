import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { deleteOrConflict } from '../common/delete-helpers';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLandingPageDto } from './dto/create-landing-page.dto';
import type { UpdateLandingPageDto } from './dto/update-landing-page.dto';

@Injectable()
export class LandingPagesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLandingPageDto) {
    return this.prisma.landingPage.create({
      data: {
        lead_type: dto.lead_type,
        name: dto.name,
        web_link: dto.web_link,
        status: dto.status,
        field_map: dto.field_map as Prisma.InputJsonValue | undefined,
        // A per-page secret is required — generate one when not supplied.
        intake_secret: dto.intake_secret ?? randomBytes(32).toString('hex'),
      },
    });
  }

  list() {
    return this.prisma.landingPage.findMany({ orderBy: { created_at: 'desc' } });
  }

  async get(id: string) {
    const page = await this.prisma.landingPage.findUnique({ where: { id } });
    if (!page) {
      throw new NotFoundException('Landing page not found');
    }
    return page;
  }

  async update(id: string, dto: UpdateLandingPageDto) {
    await this.get(id);
    const { field_map, ...rest } = dto;
    return this.prisma.landingPage.update({
      where: { id },
      data: {
        ...rest,
        ...(field_map !== undefined ? { field_map: field_map as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await deleteOrConflict(
      () => this.prisma.landingPage.delete({ where: { id } }),
      'landing page',
    );
    return { id, deleted: true };
  }
}
