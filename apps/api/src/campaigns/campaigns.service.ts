import { Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  create(actor: AuthPrincipal, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        ads_type: dto.ads_type,
        details: dto.details,
        production_link: dto.production_link,
        budget: dto.budget,
        day_count: dto.day_count,
        results: dto.results as Prisma.InputJsonValue | undefined,
        created_by: actor.id,
      },
    });
  }

  list() {
    return this.prisma.campaign.findMany({ orderBy: { created_at: 'desc' } });
  }

  async get(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  async updateResults(id: string, results: Record<string, unknown>) {
    await this.get(id);
    return this.prisma.campaign.update({
      where: { id },
      data: { results: results as Prisma.InputJsonValue },
    });
  }
}
