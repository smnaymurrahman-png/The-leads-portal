'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet } from '@/lib/proxy-client';

interface OrderRow {
  id: string;
  public_order_id: string;
  status: string;
  total_amount: string | number;
  created_at: string;
  client?: { full_name: string } | null;
}

const money = (n: string | number): string =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  FULFILLING: 'default',
  COMPLETED: 'secondary',
  PENDING_APPROVAL: 'outline',
  AWAITING_PAYMENT: 'outline',
  CANCELLED: 'destructive',
  REFUNDED: 'destructive',
};

/** Latest 6 orders, with a deep link to the full orders screen. */
export function RecentOrdersCard({ ordersHref }: { ordersHref: string }) {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const all = await apiGet<OrderRow[]>('orders');
        setRows(
          [...all]
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            )
            .slice(0, 6),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load orders');
      }
    })();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>The six most recent orders across all clients.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" render={<Link href={ordersHref} />}>
          View all
          <ArrowRight className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="px-6 pb-6 text-sm text-destructive">{error}</p>
        ) : !rows ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.public_order_id}</TableCell>
                  <TableCell className="text-sm">{order.client?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>
                      {order.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(order.total_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
