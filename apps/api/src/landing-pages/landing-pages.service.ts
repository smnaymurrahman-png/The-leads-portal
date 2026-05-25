import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadState, type Prisma } from '@prisma/client';
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

  /**
   * Per-landing-page metrics for the detail control center: lifetime + today
   * + 7d totals, a state breakdown, reject-reason breakdown, a 14-day daily
   * series, and the last 20 intakes for the inline activity table.
   */
  async metrics(id: string) {
    await this.get(id);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    const fourteenDaysAgo = new Date(startOfToday);
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);

    const [total, today, last7, byState, byReject, recent, daily] = await Promise.all([
      this.prisma.lead.count({ where: { landing_page_id: id } }),
      this.prisma.lead.count({
        where: { landing_page_id: id, captured_at: { gte: startOfToday } },
      }),
      this.prisma.lead.count({
        where: { landing_page_id: id, captured_at: { gte: sevenDaysAgo } },
      }),
      this.prisma.lead.groupBy({
        by: ['lead_state'],
        where: { landing_page_id: id },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['reject_reason'],
        where: { landing_page_id: id, lead_state: LeadState.REJECTED },
        _count: { _all: true },
      }),
      this.prisma.lead.findMany({
        where: { landing_page_id: id },
        orderBy: { captured_at: 'desc' },
        take: 20,
        select: {
          id: true,
          public_lead_id: true,
          full_name: true,
          email: true,
          phone: true,
          lead_state: true,
          reject_reason: true,
          captured_at: true,
        },
      }),
      this.prisma.lead.findMany({
        where: { landing_page_id: id, captured_at: { gte: fourteenDaysAgo } },
        select: { captured_at: true, lead_state: true },
      }),
    ]);

    // Bucket daily counts so the trend chart always has a row per day.
    const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
    const buckets: Record<string, { date: string; total: number; valid: number; rejected: number }> = {};
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(fourteenDaysAgo);
      day.setUTCDate(fourteenDaysAgo.getUTCDate() + offset);
      const key = dayKey(day);
      buckets[key] = { date: key, total: 0, valid: 0, rejected: 0 };
    }
    for (const lead of daily) {
      const key = dayKey(lead.captured_at);
      const bucket = buckets[key];
      if (!bucket) continue;
      bucket.total += 1;
      if (lead.lead_state === LeadState.REJECTED) bucket.rejected += 1;
      else bucket.valid += 1;
    }

    return {
      counts: { total, today, last7 },
      byState: byState.map((b) => ({ state: b.lead_state, count: b._count._all })),
      byRejectReason: byReject.map((b) => ({
        reason: b.reject_reason ?? 'UNKNOWN',
        count: b._count._all,
      })),
      series: Object.values(buckets),
      recent,
    };
  }

  /**
   * Generates a fresh HMAC intake secret and returns it ONCE so the caller
   * can show it to the operator. The new secret is what every subsequent
   * intake request must sign with.
   */
  async rotateSecret(id: string) {
    await this.get(id);
    const intake_secret = randomBytes(32).toString('hex');
    return this.prisma.landingPage.update({
      where: { id },
      data: { intake_secret },
      select: {
        id: true,
        name: true,
        intake_secret: true,
      },
    });
  }
}

