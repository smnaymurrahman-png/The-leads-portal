'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Coins, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { ChartSkeleton, StatGridSkeleton } from '@/components/skeletons';
import { apiGet } from '@/lib/proxy-client';

interface Transaction {
  amount: string;
  type: 'CHARGE' | 'REFUND' | 'CREDIT';
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  created_at: string;
}

interface LeadItem {
  leadId: string;
  leadType: string;
  deliveryStatus: string;
  capturedAt: string;
  createdAt: string;
}

interface OrderRow {
  id: string;
  status: string;
  quantity_paid: number;
  quantity_remaining: number;
}

interface ReplacementRow {
  id: string;
  status: string;
}

const chartConfig: ChartConfig = {
  spend: { label: 'Spend', color: 'var(--chart-1)' },
  leads: { label: 'Leads', color: 'var(--chart-2)' },
};

const money = (n: number): string =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number): string =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const shortDate = (iso: string): string => iso.slice(5).replace('-', '/');

/**
 * Client-side analytics — derived entirely from /transactions/mine + /leads/mine
 * + /orders + /replacements so no new aggregation endpoint is needed.
 */
export function ClientReportsScreen() {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [leads, setLeads] = useState<LeadItem[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [reps, setReps] = useState<ReplacementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, l, o, r] = await Promise.all([
        apiGet<Transaction[]>('transactions/mine'),
        apiGet<LeadItem[]>('leads/mine'),
        apiGet<OrderRow[]>('orders'),
        apiGet<ReplacementRow[]>('replacements'),
      ]);
      setTxs(t);
      setLeads(l);
      setOrders(o);
      setReps(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 30-day daily series, bucketed by UTC day.
  const series = useMemo(() => {
    if (!txs || !leads) return null;
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);

    const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
    const bucket: Record<string, { date: string; spend: number; leads: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      bucket[dayKey(d)] = { date: dayKey(d), spend: 0, leads: 0 };
    }
    for (const t of txs) {
      if (t.status !== 'SUCCEEDED') continue;
      const key = dayKey(new Date(t.created_at));
      if (!bucket[key]) continue;
      const sign = t.type === 'CHARGE' ? 1 : -1;
      bucket[key].spend += sign * Number(t.amount);
    }
    for (const l of leads) {
      if (l.deliveryStatus !== 'DELIVERED') continue;
      const key = dayKey(new Date(l.createdAt));
      if (!bucket[key]) continue;
      bucket[key].leads += 1;
    }
    return Object.values(bucket).map((b) => ({ ...b, spend: Number(b.spend.toFixed(2)) }));
  }, [txs, leads]);

  const totals = useMemo(() => {
    if (!txs || !leads || !orders || !reps) return null;
    const succeeded = txs.filter((t) => t.status === 'SUCCEEDED');
    const net = succeeded.reduce(
      (s, t) => s + (t.type === 'CHARGE' ? 1 : -1) * Number(t.amount),
      0,
    );
    const delivered = leads.filter((l) => l.deliveryStatus === 'DELIVERED').length;
    const cpl = delivered > 0 ? net / delivered : 0;
    const replacementRate = delivered > 0 ? reps.length / delivered : 0;
    return { net, delivered, cpl, replacementRate, openOrders: orders.length };
  }, [txs, leads, orders, reps]);

  const byType = useMemo(() => {
    if (!leads) return null;
    const m = new Map<string, number>();
    for (const l of leads) {
      if (l.deliveryStatus !== 'DELIVERED') continue;
      m.set(l.leadType, (m.get(l.leadType) ?? 0) + 1);
    }
    return Array.from(m, ([type, count]) => ({ type, count })).sort(
      (a, b) => b.count - a.count,
    );
  }, [leads]);

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Spend & lead performance"
        description="A 30-day view of what you've paid and what landed. All computed from your own transactions and leads."
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : !totals ? (
        <StatGridSkeleton count={4} />
      ) : (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Net spend"
            value={moneyShort(totals.net)}
            hint="Successful charges minus refunds."
            icon={Coins}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            label="Leads delivered"
            value={totals.delivered.toLocaleString()}
            hint="All-time, acknowledged."
            icon={Zap}
            iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          />
          <StatCard
            label="Cost per lead"
            value={totals.delivered > 0 ? money(totals.cpl) : '—'}
            hint="Net spend ÷ delivered leads."
          />
          <StatCard
            label="Replacement rate"
            value={`${(totals.replacementRate * 100).toFixed(1)}%`}
            hint={`${totals.delivered > 0 ? totals.delivered : 0} delivered, requests counted across all time.`}
            icon={RefreshCw}
          />
        </section>
      )}

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>30-day activity</CardTitle>
            <CardDescription>
              Daily spend (bars, left axis) and delivered leads (bars, right axis).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!series ? (
              <ChartSkeleton />
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={series} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="spend"
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => moneyShort(Number(v))}
                  />
                  <YAxis
                    yAxisId="leads"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => shortDate(String(v))}
                        formatter={(value, name) =>
                          name === 'Spend' ? money(Number(value)) : String(value)
                        }
                      />
                    }
                  />
                  <Bar
                    yAxisId="spend"
                    dataKey="spend"
                    fill="var(--color-spend)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="leads"
                    dataKey="leads"
                    fill="var(--color-leads)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivered by type</CardTitle>
            <CardDescription>What you've actually been buying.</CardDescription>
          </CardHeader>
          <CardContent>
            {byType === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : byType.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="size-4" />
                Nothing delivered yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {byType.map((row) => (
                  <li
                    key={row.type}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="capitalize text-foreground">
                      {row.type.toLowerCase()}
                    </span>
                    <span className="font-medium tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
