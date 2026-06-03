'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Download, FileText, Loader2, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';
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
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatGridSkeleton, TableSkeleton } from '@/components/skeletons';
import { apiGet } from '@/lib/proxy-client';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: string;
  issued_at: string | null;
  order: { public_order_id: string; lead_type: string; delivery_mode: string } | null;
}

interface OrderSummary {
  id: string;
  public_order_id: string;
  total_amount: string;
  status: string;
  created_at: string;
}

/** Orders still waiting on payment from the client (pre-activation). */
const OPEN_STATUSES = new Set(['AWAITING_PAYMENT', 'PROOF_SUBMITTED']);

const money = (n: string | number): string =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number): string =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Client billing screen. Payment is collected off-platform (the client pays
 * their agent, who uploads proof for admin verification). This screen shows
 * issued invoices (with PDF download) plus any orders still awaiting payment.
 */
export function ClientBillingScreen() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [inv, ord] = await Promise.all([
        apiGet<InvoiceRow[]>('invoices'),
        apiGet<OrderSummary[]>('orders'),
      ]);
      setInvoices(inv);
      setOrders(ord);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing data');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function downloadInvoice(id: string): Promise<void> {
    setDownloadingId(id);
    try {
      const { url } = await apiGet<{ url: string }>(`invoices/${id}/pdf-url`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open the invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  }

  const totals = (() => {
    if (!invoices || !orders) return null;
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    let paidMonth = 0;
    let paidAllTime = 0;
    for (const inv of invoices) {
      const amt = Number(inv.amount);
      paidAllTime += amt;
      if (inv.issued_at && new Date(inv.issued_at) >= month) paidMonth += amt;
    }
    const awaiting = orders
      .filter((o) => OPEN_STATUSES.has(o.status))
      .reduce((s, o) => s + Number(o.total_amount), 0);
    return { paidMonth, paidAllTime, awaiting, invoiceCount: invoices.length };
  })();

  const openOrders = (orders ?? []).filter((o) => OPEN_STATUSES.has(o.status));

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Invoices & payments"
        description="Payment is arranged with your agent. Once verified, your invoice appears here to download."
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
            value={moneyShort(totals.paidMonth)}
            hint="Invoiced in the current calendar month."
            icon={Wallet}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            label="All time"
            value={moneyShort(totals.paidAllTime)}
            hint="Total invoiced to date."
            icon={CreditCard}
          />
          <StatCard
            label="Awaiting payment"
            value={moneyShort(totals.awaiting)}
            hint="Orders not yet activated."
          />
          <StatCard
            label="Invoices"
            value={totals.invoiceCount.toLocaleString()}
            hint="On record."
            icon={Receipt}
          />
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>
              Issued once an admin verifies your payment. Newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {invoices === null ? (
              <TableSkeleton columns={5} rows={6} />
            ) : invoices.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No invoices yet"
                description="Once a payment is verified, the invoice will land here to download."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {inv.order?.public_order_id ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {inv.issued_at
                          ? new Date(inv.issued_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(inv.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === inv.id}
                          onClick={() => void downloadInvoice(inv.id)}
                        >
                          {downloadingId === inv.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          PDF
                        </Button>
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
            <CardTitle>Awaiting payment</CardTitle>
            <CardDescription>
              Pay your agent (e.g. via WhatsApp) to activate these orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orders === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : openOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders waiting on payment.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {openOrders.map((o) => (
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
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <FileText className="size-3.5" />
                      {o.status === 'PROOF_SUBMITTED' ? 'Verifying' : 'Pay agent'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
