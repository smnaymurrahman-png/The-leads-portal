import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import type { LeadPriceDto } from './dto/update-pricing.dto';

/** Lead prices live in the `settings` table under this key. */
const LEAD_PRICES_KEY = 'lead_prices';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Current price list — empty array when never set. */
  async list(): Promise<LeadPriceDto[]> {
    const setting = await this.prisma.setting.findUnique({ where: { key: LEAD_PRICES_KEY } });
    return (setting?.value as unknown as LeadPriceDto[] | null) ?? [];
  }

  /** Replaces the whole price list. Audited as a pricing change. */
  async replace(actor: AuthPrincipal, prices: LeadPriceDto[]): Promise<LeadPriceDto[]> {
    const previous = await this.list();
    const value = prices as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key: LEAD_PRICES_KEY },
      update: { value },
      create: {
        key: LEAD_PRICES_KEY,
        description: 'Per-lead pricing (USD) by lead type and delivery mode.',
        value,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'PRICING_CHANGE',
      entity: 'setting',
      entityId: LEAD_PRICES_KEY,
      before: previous,
      after: prices,
    });
    return prices;
  }
}
