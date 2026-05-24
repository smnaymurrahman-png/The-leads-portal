'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { apiGet } from '@/lib/proxy-client';

interface SeriesPoint {
  date: string; // YYYY-MM-DD
  charges: number;
  orders: number;
  leads: number;
}

const config: ChartConfig = {
  charges: { label: 'Revenue', color: 'var(--chart-1)' },
  orders: { label: 'Orders', color: 'var(--chart-4)' },
};

const money = (n: number): string =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const shortDate = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${m}/${d}`;
};

/** 14-day revenue + order-count area chart for the super-admin dashboard. */
export function RevenueTrendCard() {
  const [data, setData] = useState<SeriesPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await apiGet<SeriesPoint[]>('reports/series?days=14'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load trend');
      }
    })();
  }, []);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Revenue trend</CardTitle>
        <CardDescription>Daily charges and order volume over the last 14 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <ChartContainer config={config} className="h-[260px] w-full">
            <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="charges-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-charges)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-charges)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="orders-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-orders)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-orders)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => money(Number(v))}
              />
              <RechartsTooltip
                cursor={{ stroke: 'var(--border)' }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) => shortDate(String(v))}
                    formatter={(value, name) =>
                      name === 'Revenue' ? money(Number(value)) : Number(value).toString()
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="charges"
                stroke="var(--color-charges)"
                strokeWidth={2}
                fill="url(#charges-fill)"
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="var(--color-orders)"
                strokeWidth={2}
                fill="url(#orders-fill)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
