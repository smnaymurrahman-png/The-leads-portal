'use client';

import { type FormEvent, useState } from 'react';
import { Button, Input, Panel, Select, Table } from '@/components/ui';
import { clean, num, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const DELIVERY_MODES = ['EXCLUSIVE', 'SHARED'];

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

/**
 * Order lifecycle screen. CLIENT places orders and pays; ADMIN/SUPER_ADMIN
 * accept or reject; AGENT views only.
 */
export function OrdersScreen({ role }: { role: string }) {
  const isClient = role === 'CLIENT';
  const isDecider = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: orders, loading, error, reload } = useResource<OrderRow>('orders');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setFormError(null);

    let criteria: Record<string, unknown> = {};
    const rawCriteria = str(fd.get('criteria'));
    if (rawCriteria) {
      try {
        criteria = JSON.parse(rawCriteria) as Record<string, unknown>;
      } catch {
        setFormError('Criteria must be valid JSON.');
        setSaving(false);
        return;
      }
    }

    try {
      await apiSend('POST', 'orders', {
        lead_type: str(fd.get('lead_type')),
        delivery_mode: str(fd.get('delivery_mode')),
        quantity: num(fd.get('quantity')),
        criteria,
        ...clean({ requirements: opt(fd.get('requirements')) }),
      });
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id: string, path: string, body: unknown): Promise<void> {
    setBusyId(id);
    setActionError(null);
    try {
      await apiSend('POST', `orders/${id}/${path}`, body);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  function reject(id: string): void {
    const note = window.prompt('Reason for rejecting this order:');
    if (note && note.trim()) {
      void runAction(id, 'reject', { reject_note: note.trim() });
    }
  }

  function rowActions(order: OrderRow) {
    if (isDecider && order.status === 'REQUESTED') {
      return (
        <div className="flex gap-2">
          <Button type="button" disabled={busyId === order.id} onClick={() => void runAction(order.id, 'accept', {})}>
            Accept
          </Button>
          <button
            type="button"
            disabled={busyId === order.id}
            onClick={() => reject(order.id)}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      );
    }
    if (
      (order.status === 'INVOICED' || order.status === 'PAYMENT_FAILED') &&
      order.stripe_payment_link
    ) {
      return (
        <div className="flex gap-2">
          <a
            href={order.stripe_payment_link}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Pay now
          </a>
          {(isClient || isDecider) && (
            <button
              type="button"
              disabled={busyId === order.id}
              onClick={() => void runAction(order.id, 'payment-link', {})}
              className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              New link
            </button>
          )}
        </div>
      );
    }
    return <span className="text-slate-600">—</span>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Orders</h1>
        <p className="text-sm text-slate-500">
          {isClient
            ? 'Request leads, then pay the invoice to activate the order.'
            : isDecider
              ? 'Accept an order to invoice the client, or reject it with a note.'
              : 'Orders placed by your clients (view only).'}
        </p>
      </header>

      {isClient && (
        <Panel title="Request an order">
          <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Lead type" name="lead_type" defaultValue="SOLAR" required>
              {LEAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select label="Delivery mode" name="delivery_mode" defaultValue="EXCLUSIVE" required>
              {DELIVERY_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Input label="Quantity" name="quantity" type="number" min={1} defaultValue={10} required />
            <Input label="Requirements" name="requirements" />
            <Input
              label='Criteria JSON (e.g. {"geo":{"state":"AZ"}})'
              name="criteria"
              className="sm:col-span-2"
            />
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit request'}
              </Button>
              {formError && <span className="text-sm text-red-400">{formError}</span>}
            </div>
          </form>
        </Panel>
      )}

      <Panel title={`Orders (${orders.length})`}>
        {actionError && <p className="mb-3 text-sm text-red-400">{actionError}</p>}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-500">No orders yet.</p>
        ) : (
          <Table
            headers={['Order', 'Client', 'Type', 'Mode', 'Qty', 'Remaining', 'Total', 'Status', 'Actions']}
            rows={orders.map((o) => [
              <span key="id" className="font-mono text-xs">
                {o.public_order_id}
              </span>,
              o.client?.business_name ?? o.client?.full_name ?? '—',
              o.lead_type,
              o.delivery_mode,
              o.quantity_paid,
              o.quantity_remaining,
              `$${o.total_amount}`,
              <span key="status">
                {o.status}
                {o.reject_note && (
                  <span className="block text-xs text-slate-500">{o.reject_note}</span>
                )}
              </span>,
              rowActions(o),
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
