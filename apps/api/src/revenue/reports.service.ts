import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  LeadState,
  OrderStatus,
  Prisma,
  RejectReason,
  TxnStatus,
  TxnType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueService } from './revenue.service';

function toNumber(value: Prisma.Decimal | null): number {
  return value === null ? 0 : Number(value);
}

/** Safe ratio rounded to 4 dp. */
function ratio(part: number, whole: number): number {
  return whole > 0 ? Number((part / whole).toFixed(4)) : 0;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revenue: RevenueService,
  ) {}

  /** KPI bundle — lead quality, fulfilment and buyer metrics. */
  async kpis() {
    const [
      totalLeads,
      rejectedLeads,
      duplicateLeads,
      unsoldPool,
      deliveredAssignments,
      totalReplacements,
      expenses,
      deliveredTimes,
      paidOrderGroups,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { lead_state: LeadState.REJECTED } }),
      this.prisma.lead.count({ where: { reject_reason: RejectReason.DUPLICATE } }),
      this.prisma.lead.count({ where: { lead_state: LeadState.UNSOLD_POOL } }),
      this.prisma.leadAssignment.count({ where: { delivery_status: DeliveryStatus.DELIVERED } }),
      this.prisma.replacement.count(),
      this.prisma.expense.aggregate({ _sum: { amount: true } }),
      this.prisma.leadAssignment.findMany({
        where: { delivery_status: DeliveryStatus.DELIVERED, delivered_at: { not: null } },
        select: { delivered_at: true, lead: { select: { captured_at: true } } },
      }),
      this.prisma.order.groupBy({
        by: ['client_id'],
        where: {
          status: { in: [OrderStatus.ACTIVE, OrderStatus.FULFILLING, OrderStatus.COMPLETED] },
        },
        _count: true,
      }),
    ]);

    const expenseTotal = toNumber(expenses._sum.amount);

    // Average capture → delivery time across delivered leads.
    let captureToDeliveryMinutes = 0;
    if (deliveredTimes.length > 0) {
      const totalMs = deliveredTimes.reduce(
        (sum, a) => sum + ((a.delivered_at as Date).getTime() - a.lead.captured_at.getTime()),
        0,
      );
      captureToDeliveryMinutes = Math.round(totalMs / deliveredTimes.length / 60_000);
    }

    const buyersWithOrders = paidOrderGroups.length;
    const repeatBuyers = paidOrderGroups.filter((group) => group._count >= 2).length;
    const acceptedLeads = Math.max(deliveredAssignments - totalReplacements, 0);

    return {
      totalLeads,
      deliveredLeads: deliveredAssignments,
      costPerLead: totalLeads > 0 ? Number((expenseTotal / totalLeads).toFixed(2)) : 0,
      validLeadRate: ratio(totalLeads - rejectedLeads, totalLeads),
      duplicateRate: ratio(duplicateLeads, totalLeads),
      replacementRate: ratio(totalReplacements, deliveredAssignments),
      acceptanceRate: ratio(acceptedLeads, deliveredAssignments),
      buyerRetentionRate: ratio(repeatBuyers, buyersWithOrders),
      unsoldPoolSize: unsoldPool,
      captureToDeliveryMinutes,
    };
  }

  /** Super-admin dashboard — totals, today's sales/orders, revenue summary. */
  async dashboard() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [users, clients, orders, leads, todayOrders, todayCharges, revenue] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.client.count(),
      this.prisma.order.count(),
      this.prisma.lead.count(),
      this.prisma.order.count({ where: { created_at: { gte: startOfToday } } }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: TxnType.CHARGE,
          status: TxnStatus.SUCCEEDED,
          created_at: { gte: startOfToday },
        },
      }),
      this.revenue.summary(),
    ]);

    return {
      totals: { users, clients, orders, leads },
      today: { orders: todayOrders, sales: toNumber(todayCharges._sum.amount) },
      revenue,
    };
  }

  /** Leads ledger — recent leads with state and assignment count. */
  async leadsLedger(limit = 100) {
    const leads = await this.prisma.lead.findMany({
      orderBy: { captured_at: 'desc' },
      take: Math.min(limit, 500),
      include: { _count: { select: { assignments: true } } },
    });
    return leads.map((lead) => ({
      id: lead.id,
      publicLeadId: lead.public_lead_id,
      leadType: lead.lead_type,
      state: lead.lead_state,
      rejectReason: lead.reject_reason,
      capturedAt: lead.captured_at,
      assignments: lead._count.assignments,
    }));
  }
}
