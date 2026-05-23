import { Injectable } from '@nestjs/common';
import { Prisma, TxnStatus, TxnType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthPrincipal } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExpenseDto } from './dto/create-expense.dto';

/** Settings key holding the agent commission rate. */
const COMMISSION_RATE_KEY = 'commission_rate';
const DEFAULT_COMMISSION_RATE = 0.1;

function toNumber(value: Prisma.Decimal | null): number {
  return value === null ? 0 : Number(value);
}

@Injectable()
export class RevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Commission rate applied to each paid order (fraction of the total). */
  async getCommissionRate(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: COMMISSION_RATE_KEY } });
    const value = row?.value;
    return typeof value === 'number' && value >= 0 ? value : DEFAULT_COMMISSION_RATE;
  }

  async setCommissionRate(actor: AuthPrincipal, rate: number): Promise<{ rate: number }> {
    const previous = await this.getCommissionRate();
    await this.prisma.setting.upsert({
      where: { key: COMMISSION_RATE_KEY },
      update: { value: rate },
      create: {
        key: COMMISSION_RATE_KEY,
        description: 'Agent commission rate (fraction of a paid order total).',
        value: rate,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: 'COMMISSION_RATE_CHANGE',
      entity: 'setting',
      entityId: COMMISSION_RATE_KEY,
      before: { rate: previous },
      after: { rate },
    });
    return { rate };
  }

  /** Total sales, refunds, expenses, commissions and profit/loss. */
  async summary() {
    const [charges, refunds, expenses, commissions] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: TxnType.CHARGE, status: TxnStatus.SUCCEEDED },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: TxnType.REFUND, status: TxnStatus.SUCCEEDED },
      }),
      this.prisma.expense.aggregate({ _sum: { amount: true } }),
      this.prisma.commission.aggregate({ _sum: { amount: true } }),
    ]);

    const grossSales = toNumber(charges._sum.amount);
    const refundTotal = toNumber(refunds._sum.amount);
    const expenseTotal = toNumber(expenses._sum.amount);
    const commissionTotal = toNumber(commissions._sum.amount);
    const netSales = grossSales - refundTotal;

    return {
      grossSales,
      refunds: refundTotal,
      netSales,
      expenses: expenseTotal,
      commissions: commissionTotal,
      profit: Number((netSales - expenseTotal - commissionTotal).toFixed(2)),
    };
  }

  listCommissions() {
    return this.prisma.commission.findMany({
      include: {
        agent: { select: { id: true, full_name: true } },
        order: { select: { id: true, public_order_id: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  listExpenses() {
    return this.prisma.expense.findMany({ orderBy: { incurred_at: 'desc' } });
  }

  createExpense(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        category: dto.category,
        amount: dto.amount,
        campaign_id: dto.campaign_id,
        incurred_at: dto.incurred_at ? new Date(dto.incurred_at) : undefined,
      },
    });
  }
}
