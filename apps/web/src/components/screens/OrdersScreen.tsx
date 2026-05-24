'use client';

import { useState } from 'react';
import { Check, ExternalLink, Loader2, RefreshCw, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { usePromptDialog } from '@/components/PromptDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { clean, num, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const DELIVERY_MODES = ['EXCLUSIVE', 'SHARED'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  REQUESTED: 'outline',
  ACCEPTED: 'secondary',
  INVOICED: 'outline',
  PAYMENT_FAILED: 'destructive',
  ACTIVE: 'default',
  FULFILLING: 'default',
  COMPLETED: 'secondary',
  REJECTED: 'destructive',
  CANCELLED: 'destructive',
  REFUNDED: 'destructive',
};

interface OrderRow {
  id: string;
  public_order_id: string;
  lead_type: string;
  delivery_mode: string;
  quantity_paid: number;
  quantity_remaining: number;
  total_amount: string;
  status: string;
  stripe_payment_link: string | null;
  reject_note: string | null;
  client: { full_name: string; business_name: string | null } | null;
}

const money = (n: string | number): string =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Order lifecycle screen. CLIENT places orders and pays; ADMIN/SUPER_ADMIN
 * accept or reject; AGENT views only.
 */
export function OrdersScreen({ role }: { role: string }) {
  const isClient = role === 'CLIENT';
  const isDecider = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: orders, loading, error, reload } = useResource<OrderRow>('orders');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [askReason, promptMount] = usePromptDialog();

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);

    let criteria: Record<string, unknown> = {};
    const rawCriteria = str(fd.get('criteria'));
    if (rawCriteria) {
      try {
        criteria = JSON.parse(rawCriteria) as Record<string, unknown>;
      } catch {
        throw new Error('Criteria must be valid JSON.');
      }
    }

    await apiSend('POST', 'orders', {
      lead_type: str(fd.get('lead_type')),
      delivery_mode: str(fd.get('delivery_mode')),
      quantity: num(fd.get('quantity')),
      criteria,
      ...clean({ requirements: opt(fd.get('requirements')) }),
    });
    await reload();
    toast.success('Order submitted for review');
  }

  async function runAction(
    id: string,
    path: string,
    body: unknown,
    successMessage: string,
  ): Promise<void> {
    setBusyId(id);
    try {
      await apiSend('POST', `orders/${id}/${path}`, body);
      await reload();
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string): Promise<void> {
    const note = await askReason({
      title: 'Reject this order',
      description: 'The client will see this note next to the rejected status.',
      label: 'Reason',
      placeholder: "Why is the order being rejected? (won't be sent without a note)",
      confirmLabel: 'Reject order',
      destructive: true,
    });
    if (note) {
      await runAction(id, 'reject', { reject_note: note }, 'Order rejected');
    }
  }

  function rowActions(order: OrderRow) {
    if (isDecider && order.status === 'REQUESTED') {
      return (
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={busyId === order.id}
            onClick={() => void runAction(order.id, 'accept', {}, 'Order accepted — client will be invoiced')}
          >
            {busyId === order.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Accept
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busyId === order.id}
            onClick={() => reject(order.id)}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      );
    }
    if (
      (order.status === 'INVOICED' || order.status === 'PAYMENT_FAILED') &&
      order.stripe_payment_link
    ) {
      return (
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            render={
              <a href={order.stripe_payment_link} target="_blank" rel="noreferrer noopener" />
            }
          >
            <ExternalLink className="size-3.5" />
            Pay
          </Button>
          {(isClient || isDecider) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyId === order.id}
              onClick={() =>
                void runAction(order.id, 'payment-link', {}, 'New payment link generated')
              }
              aria-label="Regenerate payment link"
              title="Regenerate payment link"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
        </div>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description={
          isClient
            ? 'Request leads, then pay the invoice to activate the order.'
            : isDecider
              ? 'Accept an order to invoice the client, or reject it with a note.'
              : 'Orders placed by your clients (view only).'
        }
        actions={
          isClient ? (
            <FormDialog
              triggerLabel="Place order"
              title="Request an order"
              description="Submitted orders are reviewed by an admin before invoicing."
              submitLabel="Submit request"
              contentClassName="max-w-xl"
              onSubmit={onCreate}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Lead type">
                  <Select name="lead_type" defaultValue="SOLAR">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Delivery mode">
                  <Select name="delivery_mode" defaultValue="EXCLUSIVE">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quantity">
                  <Input
                    name="quantity"
                    type="number"
                    min={1}
                    defaultValue={10}
                    required
                  />
                </Field>
                <Field label="Requirements">
                  <Input name="requirements" placeholder="optional" />
                </Field>
                <Field label="Criteria JSON" hint="optional" className="sm:col-span-2">
                  <Input
                    name="criteria"
                    placeholder='{"geo":{"state":"AZ"},"age_min":25}'
                  />
                </Field>
              </div>
            </FormDialog>
          ) : null
        }
      />

      {promptMount}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={9} rows={6} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders yet"
              description={
                isClient
                  ? 'Place an order to start receiving leads. Submitted orders go through admin review.'
                  : isDecider
                    ? 'New order requests will land here for you to review.'
                    : "Your clients' orders will appear here as they're placed."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.public_order_id}</TableCell>
                    <TableCell className="text-sm">
                      {o.client?.business_name ?? o.client?.full_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {o.lead_type.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {o.delivery_mode.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.quantity_paid}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.quantity_remaining}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(o.total_amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
                          {o.status.toLowerCase().replace('_', ' ')}
                        </Badge>
                        {o.reject_note && (
                          <span className="text-xs text-muted-foreground">{o.reject_note}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{rowActions(o)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
