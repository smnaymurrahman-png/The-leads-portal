import { Injectable } from '@nestjs/common';
import { type LeadType, type Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';

/** Settings key holding the distribution pause / hold toggles. */
const CONTROLS_KEY = 'distribution_controls';

export interface DistributionControls {
  /** Lead types whose auto-distribution is paused. */
  pausedLeadTypes: LeadType[];
  /** Lead types whose valid leads are held for manual review. */
  holdLeadTypes: LeadType[];
}

function toggle<T extends string>(list: T[], value: T, on: boolean | undefined): T[] {
  if (on === undefined) {
    return list;
  }
  const without = list.filter((item) => item !== value);
  return on ? [...without, value] : without;
}

/** Reads / writes the per-lead-type distribution pause + hold toggles. */
@Injectable()
export class DistributionControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<DistributionControls> {
    const row = await this.prisma.setting.findUnique({ where: { key: CONTROLS_KEY } });
    const value = (row?.value ?? null) as Partial<DistributionControls> | null;
    return {
      pausedLeadTypes: value?.pausedLeadTypes ?? [],
      holdLeadTypes: value?.holdLeadTypes ?? [],
    };
  }

  /** Whether auto-distribution is currently blocked for a lead type. */
  async isBlocked(
    leadType: LeadType,
  ): Promise<{ blocked: boolean; reason?: 'PAUSED' | 'HOLD' }> {
    const controls = await this.get();
    if (controls.pausedLeadTypes.includes(leadType)) {
      return { blocked: true, reason: 'PAUSED' };
    }
    if (controls.holdLeadTypes.includes(leadType)) {
      return { blocked: true, reason: 'HOLD' };
    }
    return { blocked: false };
  }

  async setLeadType(
    actor: AuthPrincipal,
    leadType: LeadType,
    change: { paused?: boolean; hold?: boolean },
  ): Promise<DistributionControls> {
    const current = await this.get();
    const next: DistributionControls = {
      pausedLeadTypes: toggle(current.pausedLeadTypes, leadType, change.paused),
      holdLeadTypes: toggle(current.holdLeadTypes, leadType, change.hold),
    };
    await this.prisma.setting.upsert({
      where: { key: CONTROLS_KEY },
      update: { value: next as unknown as Prisma.InputJsonValue },
      create: {
        key: CONTROLS_KEY,
        description: 'Auto-distribution pause / hold-for-review toggles per lead type.',
        value: next as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'DISTRIBUTION_RULE_CHANGE',
      entity: 'setting',
      entityId: CONTROLS_KEY,
      before: current,
      after: next,
    });
    return next;
  }
}
