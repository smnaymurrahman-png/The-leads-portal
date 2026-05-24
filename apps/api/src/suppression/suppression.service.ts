import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSuppressionDto } from './dto/create-suppression.dto';

/**
 * Suppression list registry. Entries here block matching leads from being
 * delivered — the intake pipeline checks email/phone against this table and
 * marks the lead REJECTED with reason SUPPRESSED.
 */
@Injectable()
export class SuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: { search?: string; limit?: number } = {}) {
    const take = Math.min(query.limit ?? 200, 1000);
    return this.prisma.suppressionList.findMany({
      where: query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { reason: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { created_at: 'desc' },
      take,
    });
  }

  async create(dto: CreateSuppressionDto) {
    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;
    if (!email && !phone) {
      throw new BadRequestException('Provide an email, a phone, or both.');
    }
    return this.prisma.suppressionList.create({
      data: { email, phone, reason: dto.reason?.trim() || null },
    });
  }

  async remove(id: string) {
    const row = await this.prisma.suppressionList.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Suppression entry not found');
    }
    await this.prisma.suppressionList.delete({ where: { id } });
    return { id, deleted: true };
  }
}
