import { Building2, DollarSign, ShoppingCart, Zap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from './PageHeader';
import { RecentOrdersCard } from './RecentOrdersCard';
import { RevenueTrendCard } from './RevenueTrendCard';
import { StatCard } from './StatCard';
import { serverApiGet, type Session } from '@/lib/session';

interface Dashboard {
  totals: { users: number; clients: number; orders: number; leads: number };
  today: { orders: number; sales: number };
  revenue: {
    grossSales: number;
    refunds: number;
    netSales: number;
    expenses: number;
    commissions: number;
    profit: number;
  };
}

interface Kpis {
  totalLeads: number;
  deliveredLeads: number;
  costPerLead: number;
  validLeadRate: number;
  duplicateRate: number;
  replacementRate: number;
  acceptanceRate: number;
  buyerRetentionRate: number;
  unsoldPoolSize: number;
  captureToDeliveryMinutes: number;
}

const money = (n: number): string =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number): string =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const percent = (n: number): string => `${(n * 100).toFixed(1)}%`;

/**
 * Staff (super-admin / admin) dashboard — KPI strip, revenue trend, lead
 * health, recent orders. ADMIN and SUPER_ADMIN both have access to the
 * reports endpoints so the layout is shared; the `area` prop changes the
 * eyebrow + `ordersHref` deep-link.
 */
export async function SuperAdminDashboard({
  session,
  area = 'Super Admin',
  ordersHref = '/super-admin/orders',
}: {
  session: Session;
  area?: string;
  ordersHref?: string;
}) {
  const [dashboard, kpis] = await Promise.all([
    serverApiGet<Dashboard>('reports/dashboard'),
    serverApiGet<Kpis>('reports/kpis'),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={area}
        title={`Welcome back, ${session.name.split(' ')[0]}.`}
        description="Live snapshot of revenue, orders and lead quality across the network."
      />

      {!dashboard ? (
        <p className="text-sm text-destructive">Dashboard data unavailable.</p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Net revenue"
              value={moneyShort(dashboard.revenue.netSales)}
              hint={`${money(dashboard.revenue.grossSales)} gross · ${money(
                dashboard.revenue.refunds,
              )} refunded`}
              icon={DollarSign}
              iconClassName="bg-primary/10 text-primary"
            />
            <StatCard
              label="Profit"
              value={moneyShort(dashboard.revenue.profit)}
              hint={`Expenses ${money(dashboard.revenue.expenses)} · Comms ${money(
                dashboard.revenue.commissions,
              )}`}
              icon={ShoppingCart}
              iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            />
            <StatCard
              label="Orders today"
              value={dashboard.today.orders}
              hint={`${money(dashboard.today.sales)} captured today`}
              icon={Zap}
              iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            />
            <StatCard
              label="Active clients"
              value={dashboard.totals.clients}
              hint={`${dashboard.totals.leads.toLocaleString()} leads captured all-time`}
              icon={Building2}
              iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
            />
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RevenueTrendCard />
            <Card>
              <CardHeader>
                <CardTitle>Lead health</CardTitle>
                <CardDescription>Quality + fulfilment over the full ledger.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {kpis ? (
                  <>
                    <KpiRow label="Valid-lead rate" value={percent(kpis.validLeadRate)} />
                    <KpiRow label="Duplicate rate" value={percent(kpis.duplicateRate)} />
                    <KpiRow label="Replacement rate" value={percent(kpis.replacementRate)} />
                    <KpiRow label="Acceptance" value={percent(kpis.acceptanceRate)} />
                    <KpiRow label="Buyer retention" value={percent(kpis.buyerRetentionRate)} />
                    <KpiRow label="Unsold pool" value={kpis.unsoldPoolSize.toLocaleString()} />
                    <KpiRow
                      label="Capture → delivery"
                      value={`${kpis.captureToDeliveryMinutes} min`}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">KPIs unavailable.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="mt-4">
            <RecentOrdersCard ordersHref={ordersHref} />
          </section>
        </>
      )}
    </div>
  );
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
