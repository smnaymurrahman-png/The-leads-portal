'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, CreditCard, Receipt, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatGridSkeleton, TableSkeleton } from '@/components/skeletons';
import { apiGet } from '@/lib/proxy-client';

interface Transaction {
  id: string;
  order_id: string;
  stripe_payment_id: string | null;
  amount: string;
  type: 'CHARGE' | 'REFUND' | 'CREDIT';
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  created_at: string;
  order: {
    id: string;
    public_order_id: string;
    lead_type: string;
    delivery_mode: string;
  } | null;
}

interface OrderSummary {
  id: string;
  public_order_id: string;
  total_amount: string;
  status: string;
  stripe_payment_link: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  SUCCEEDED: 'default',
  PENDING: 'outline',
  FAILED: 'destructive',
  CANCELED: 'destructive',
};

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  CHARGE: 'default',
  REFUND: 'destructive',
  CREDIT: 'secondary',
};

const money = (n: string | number): string =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number): string =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Client billing screen — every transaction on the account, plus a quick
 * orders summary so the buyer can see what's paid, what's pending invoice,
 * and what's been refunded.
 */
export function ClientBillingScreen() {
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [t, o] = await Promise.all([
        apiGet<Transaction[]>('transactions/mine'),
        apiGet<OrderSummary[]>('orders'),
      ]);
      setTxs(t);
      setOrders(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing data');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Aggregate spend totals — counted against successful charges only, with
  // refunds subtracted so the "net spent" tile shows the real cash out.
  const totals = (() => {
    if (!txs) return null;
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    let netAllTime = 0;
    let netMonth = 0;
    let pending = 0;
    for (const t of txs) {
      const amt = Number(t.amount);
      const sign = t.type === 'CHARGE' ? 1 : -1;
      if (t.status === 'SUCCEEDED') {
        netAllTime += sign * amt;
        if (new Date(t.created_at) >= month) netMonth += sign * amt;
      } else if (t.status === 'PENDING') {
        pending += amt;
      }
    }
    const refunded = txs
      .filter((t) => t.status === 'SUCCEEDED' && t.type === 'REFUND')
      .reduce((s, t) => s + Number(t.amount), 0);
    return { netMonth, netAllTime, pending, refunded };
  })();

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Invoices & payments"
        description="Every transaction on your account. Click an order id to jump to its detail."
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
            label="This month"
            value={moneyShort(totals.netMonth)}
            hint="Net spend in the current calendar month."
            icon={Wallet}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            label="All time"
            value={moneyShort(totals.netAllTime)}
            hint={`${money(totals.refunded)} refunded.`}
            icon={CreditCard}
          />
          <StatCard
            label="Pending"
            value={moneyShort(totals.pending)}
            hint="Awaiting Stripe confirmation."
          />
          <StatCard
            label="Transactions"
            value={(txs?.length ?? 0).toLocaleString()}
            hint="On record."
            icon={Receipt}
          />
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Newest first. SUCCEEDED rows are settled; PENDING rows are awaiting Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {txs === null ? (
              <TableSkeleton columns={5} rows={6} />
            ) : txs.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Once you pay an invoice the transaction will land here for your records."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(t.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.order?.public_order_id ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANT[t.type] ?? 'secondary'}>
                          {t.type.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[t.status] ?? 'outline'}>
                          {t.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          t.type === 'REFUND' ? 'text-destructive' : 'text-foreground'
                        }`}
                      >
                        {t.type === 'REFUND' ? '−' : ''}
                        {money(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open invoices</CardTitle>
            <CardDescription>
              Orders waiting on payment from your side. Click "Pay" to settle in Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orders === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              (() => {
                const open = orders.filter(
                  (o) =>
                    (o.status === 'INVOICED' || o.status === 'PAYMENT_FAILED') &&
                    o.stripe_payment_link,
                );
                if (open.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      No invoices waiting on payment.
                    </p>
                  );
                }
                return (
                  <ul className="space-y-2 text-sm">
                    {open.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">
                            {o.public_order_id}
                          </p>
                          <p className="font-medium">{money(o.total_amount)}</p>
                        </div>
                        <a
                          href={o.stripe_payment_link ?? '#'}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <ArrowDownToLine className="size-3.5" />
                          Pay
                        </a>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
