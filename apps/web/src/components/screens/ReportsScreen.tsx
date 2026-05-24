'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Banknote,
  CircleDollarSign,
  Coins,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartSkeleton, StatGridSkeleton } from '@/components/skeletons';
import { apiGet } from '@/lib/proxy-client';

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

interface Commission {
  id: string;
  amount: string;
  rate: string;
  agent: { full_name: string } | null;
  order: { public_order_id: string } | null;
}

interface LedgerRow {
  id: string;
  publicLeadId: string;
  leadType: string;
  state: string;
  rejectReason: string | null;
  assignments: number;
}

interface SeriesPoint {
  date: string;
  charges: number;
  orders: number;
  leads: number;
}

const money = (value: number): string =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (value: number): string =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const shortDate = (iso: string): string => iso.slice(5).replace('-', '/');

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  UNSOLD_POOL: 'outline',
  RESERVED: 'secondary',
  ASSIGNED: 'default',
  DELIVERED: 'default',
  REJECTED: 'destructive',
  REPLACED: 'destructive',
};

const revenueChartConfig: ChartConfig = {
  charges: { label: 'Revenue', color: 'var(--chart-1)' },
};
const volumeChartConfig: ChartConfig = {
  orders: { label: 'Orders', color: 'var(--chart-4)' },
  leads: { label: 'Leads', color: 'var(--chart-2)' },
};

/** Revenue + KPI reporting dashboard (ADMIN / SUPER_ADMIN). */
export function ReportsScreen() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [dash, kpi, ser, comm, led] = await Promise.all([
          apiGet<Dashboard>('reports/dashboard'),
          apiGet<Kpis>('reports/kpis'),
          apiGet<SeriesPoint[]>('reports/series?days=30'),
          apiGet<Commission[]>('revenue/commissions'),
          apiGet<LedgerRow[]>('reports/leads-ledger?limit=25'),
        ]);
        setDashboard(dash);
        setKpis(kpi);
        setSeries(ser);
        setCommissions(comm);
        setLedger(led);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="Reports"
          title="Revenue & operations"
          description="Profit/loss, daily activity, agent commissions, and the live leads ledger."
        />
        <StatGridSkeleton count={4} />
        <div className="mt-8 space-y-6">
          <ChartSkeleton />
        </div>
      </div>
    );
  }
  if (error || !dashboard || !kpis) {
    return (
      <>
        <PageHeader eyebrow="Reports" title="Reports" />
        <p className="text-sm text-destructive">{error ?? 'Reports unavailable'}</p>
      </>
    );
  }

  const { revenue } = dashboard;
  const profitDirection: 'up' | 'down' | 'flat' =
    revenue.profit > 0 ? 'up' : revenue.profit < 0 ? 'down' : 'flat';

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Revenue & operations"
        description="Profit/loss, daily activity, agent commissions, and the live leads ledger."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gross sales"
          value={moneyShort(revenue.grossSales)}
          hint={`${money(revenue.refunds)} refunded`}
          icon={CircleDollarSign}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Net sales"
          value={moneyShort(revenue.netSales)}
          hint="Gross minus refunds."
          icon={Banknote}
          iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
        />
        <StatCard
          label="Expenses & comms"
          value={moneyShort(revenue.expenses + revenue.commissions)}
          hint={`${money(revenue.expenses)} expenses · ${money(revenue.commissions)} commissions`}
          icon={Receipt}
          iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        />
        <StatCard
          label="Profit / loss"
          value={moneyShort(revenue.profit)}
          trend={{
            value: revenue.profit >= 0 ? 'Positive period' : 'Loss period',
            direction: profitDirection,
          }}
          icon={profitDirection === 'down' ? TrendingDown : TrendingUp}
          iconClassName={
            profitDirection === 'down'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          }
        />
      </section>

      <Tabs defaultValue="revenue" className="mt-8">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="volume">Volume</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily revenue (last 30 days)</CardTitle>
              <CardDescription>Sum of succeeded CHARGE transactions per UTC day.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
                <BarChart data={series} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => moneyShort(Number(v))}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(value) => money(Number(value))}
                      />
                    }
                  />
                  <Bar dataKey="charges" fill="var(--color-charges)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent commissions ({commissions.length})</CardTitle>
              <CardDescription>
                Bookings against each delivered + paid order, at the configured rate.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {commissions.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  No commissions booked yet — they're created when a delivered order is paid.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.agent?.full_name ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.order?.public_order_id ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(Number(c.rate))}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(Number(c.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Orders & leads (last 30 days)</CardTitle>
              <CardDescription>
                Daily counts of new orders and leads captured into the pool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={volumeChartConfig} className="h-[280px] w-full">
                <BarChart data={series} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                  />
                  <YAxis tickLine={false} axisLine={false} width={32} />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={
                      <ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />
                    }
                  />
                  <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leads" fill="var(--color-leads)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest leads ({ledger.length})</CardTitle>
              <CardDescription>
                The most recent captures — state and assignment count at a glance.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {ledger.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No leads captured yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Reject reason</TableHead>
                      <TableHead className="text-right">Assignments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.publicLeadId}</TableCell>
                        <TableCell className="text-sm">{row.leadType}</TableCell>
                        <TableCell>
                          <Badge variant={STATE_VARIANT[row.state] ?? 'outline'}>
                            {row.state.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.rejectReason ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.assignments}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead quality KPIs</CardTitle>
              <CardDescription>Computed over the entire ledger.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <StatCard
                  label="Cost per lead"
                  value={money(kpis.costPerLead)}
                  icon={Coins}
                  iconClassName="bg-primary/10 text-primary"
                />
                <StatCard label="Valid-lead rate" value={percent(kpis.validLeadRate)} />
                <StatCard label="Duplicate rate" value={percent(kpis.duplicateRate)} />
                <StatCard label="Replacement rate" value={percent(kpis.replacementRate)} />
                <StatCard label="Acceptance" value={percent(kpis.acceptanceRate)} />
                <StatCard label="Buyer retention" value={percent(kpis.buyerRetentionRate)} />
                <StatCard
                  label="Unsold pool"
                  value={kpis.unsoldPoolSize.toLocaleString()}
                  icon={Activity}
                />
                <StatCard
                  label="Capture → delivery"
                  value={`${kpis.captureToDeliveryMinutes} min`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
