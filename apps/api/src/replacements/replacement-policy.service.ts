import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';

/** Settings key holding the replacement policy. */
const POLICY_KEY = 'replacement_policy';

export interface ReplacementPolicy {
  /** How long after delivery a lead may be replaced. */
  windowHours: number;
  /** Reasons a client may cite when requesting a replacement. */
  validReasons: string[];
}

const DEFAULT_POLICY: ReplacementPolicy = {
  windowHours: 48,
  validReasons: [
    'WRONG_NUMBER',
    'DISCONNECTED',
    'NOT_INTERESTED',
    'DUPLICATE',
    'OUT_OF_AREA',
    'INVALID_INFO',
  ],
};

/** Reads / writes the replacement policy (window + valid reasons). */
@Injectable()
export class ReplacementPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ReplacementPolicy> {
    const row = await this.prisma.setting.findUnique({ where: { key: POLICY_KEY } });
    const value = (row?.value ?? null) as Partial<ReplacementPolicy> | null;
    return {
      windowHours: value?.windowHours ?? DEFAULT_POLICY.windowHours,
      validReasons:
        Array.isArray(value?.validReasons) && value.validReasons.length > 0
          ? value.validReasons
          : DEFAULT_POLICY.validReasons,
    };
  }

  async update(
    actor: AuthPrincipal,
    change: Partial<ReplacementPolicy>,
  ): Promise<ReplacementPolicy> {
    const current = await this.get();
    const next: ReplacementPolicy = {
      windowHours: change.windowHours ?? current.windowHours,
      validReasons: change.validReasons ?? current.validReasons,
    };
    const value = next as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key: POLICY_KEY },
      update: { value },
      create: {
        key: POLICY_KEY,
        description: 'Replacement policy — window (hours) and valid reasons.',
        value,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'REPLACEMENT_POLICY_CHANGE',
      entity: 'setting',
      entityId: POLICY_KEY,
      before: current,
      after: next,
    });
    return next;
  }
}
