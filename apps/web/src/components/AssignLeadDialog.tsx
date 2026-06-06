'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiSend } from '@/lib/proxy-client';

interface OrderRow {
  id: string;
  public_order_id: string;
  lead_type: string;
  delivery_mode: string;
  quantity_remaining: number;
  status: string;
  client: { id: string; full_name: string; business_name: string | null } | null;
}

interface LeadSummary {
  id: string;
  publicLeadId: string;
  leadType: string;
  fullName?: string | null;
}

/**
 * Manual assignment dialog. Given a set of pending leads (1+) the operator
 * picks a client → one of that client's open orders matching the leads'
 * type → confirm. Bulk path runs the assignments sequentially and reports
 * each row's result.
 */
export function AssignLeadDialog({
  open,
  onOpenChange,
  leads,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: LeadSummary[];
  onDone?: () => void;
}) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Leads must all share the same lead type for a single dialog session.
  const leadType = leads[0]?.leadType;
  const mixedTypes = leads.some((l) => l.leadType !== leadType);

  useEffect(() => {
    if (!open || mixedTypes || !leadType) return;
    setOrders(null);
    setError(null);
    setClientId(null);
    setOrderId(null);
    void (async () => {
      try {
        const all = await apiGet<OrderRow[]>('orders');
        // Only orders that can actually take a new lead right now.
        setOrders(
          all.filter(
            (o) =>
              o.lead_type === leadType &&
              o.quantity_remaining > 0 &&
              (o.status === 'ACTIVE' || o.status === 'FULFILLING'),
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load orders');
      }
    })();
  }, [open, leadType, mixedTypes]);

  // Build a unique client list from the eligible orders so the picker only
  // surfaces clients that actually have an open slot for this lead type.
  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const o of orders ?? []) {
      if (!o.client) continue;
      if (!map.has(o.client.id)) {
        map.set(o.client.id, {
          id: o.client.id,
          name: o.client.business_name ?? o.client.full_name,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const clientOrders = useMemo(
    () => (orders ?? []).filter((o) => o.client?.id === clientId),
    [orders, clientId],
  );

  async function assign(): Promise<void> {
    if (!orderId || leads.length === 0) return;
    setBusy(true);
    const results = await Promise.allSettled(
      leads.map((l) =>
        apiSend('POST', `distribution/leads/${l.id}/assign`, { orderId }),
      ),
    );
    setBusy(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    if (fail === 0) toast.success(`${ok} lead${ok === 1 ? '' : 's'} assigned`);
    else if (ok === 0) {
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      toast.error(first.reason instanceof Error ? first.reason.message : 'Assign failed');
    } else {
      toast.warning(`${ok} assigned, ${fail} failed (order may be full or already assigned)`);
    }
    onDone?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign {leads.length === 1 ? 'lead' : `${leads.length} leads`} to an order
          </DialogTitle>
          <DialogDescription>
            Manual assignment bypasses the auto-matcher — the lead is dropped straight onto
            the order you pick and delivered via the realtime channel.
          </DialogDescription>
        </DialogHeader>

        {mixedTypes ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Selected leads have different types. Manual assign needs them to share one lead
            type (the chosen order's type must match). Narrow the selection by type and try
            again.
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : orders === null ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <p className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            No open <Badge variant="secondary">{leadType?.toLowerCase()}</Badge> orders with
            remaining balance. Place an order first, or wait for auto-distribution to catch
            up.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              {leads.slice(0, 3).map((l) => (
                <p key={l.id} className="truncate">
                  <code className="text-muted-foreground">{l.publicLeadId}</code>
                  {l.fullName ? ` — ${l.fullName}` : ''}
                </p>
              ))}
              {leads.length > 3 && (
                <p className="text-muted-foreground">…and {leads.length - 3} more</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Client</label>
              <Select
                value={clientId ?? undefined}
                onValueChange={(v) => {
                  setClientId(v);
                  setOrderId(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Order</label>
              <Select
                value={orderId ?? undefined}
                onValueChange={(v) => setOrderId(v ?? null)}
                disabled={!clientId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      clientId ? 'Pick an order' : 'Select a client first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {clientOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="font-mono text-xs">{o.public_order_id}</span>
                      <span className="ml-2 text-muted-foreground">
                        · {o.delivery_mode.toLowerCase()} · {o.quantity_remaining} left
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button onClick={assign} disabled={!orderId || busy || mixedTypes}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
