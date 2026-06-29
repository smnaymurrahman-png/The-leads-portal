'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef(false);

  // Leads must all share the same lead type for a single dialog session.
  const leadType = leads[0]?.leadType;
  const mixedTypes = leads.some((l) => l.leadType !== leadType);

  useEffect(() => {
    if (!open || mixedTypes || !leadType) return;
    setOrders(null);
    setError(null);
    setClientId(null);
    setOrderId(null);
    setProgress(null);
    abortRef.current = false;
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
    abortRef.current = false;
    setBusy(true);
    setProgress({ current: 0, total: leads.length });

    let ok = 0;
    let fail = 0;
    const delayMs = Math.max(0, delaySeconds) * 1000;

    for (let i = 0; i < leads.length; i++) {
      if (abortRef.current) break;
      setProgress({ current: i + 1, total: leads.length });
      try {
        await apiSend('POST', `distribution/leads/${leads[i].id}/assign`, { orderId });
        ok++;
      } catch {
        fail++;
      }
      // sleep between leads — skip after the last one
      if (delayMs > 0 && i < leads.length - 1 && !abortRef.current) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    setBusy(false);
    setProgress(null);

    if (abortRef.current) {
      toast.warning(`Stopped after ${ok} assigned, ${fail} failed`);
    } else if (fail === 0) {
      toast.success(`${ok} lead${ok === 1 ? '' : 's'} assigned`);
    } else if (ok === 0) {
      toast.error('All assignments failed (order may be full or already assigned)');
    } else {
      toast.warning(`${ok} assigned, ${fail} failed (order may be full or already assigned)`);
    }
    onDone?.();
    onOpenChange(false);
  }

  function abort(): void {
    abortRef.current = true;
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

            {leads.length > 1 && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">
                  Delay between leads
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Math.max(0, Number(e.target.value)))}
                    className="h-9 w-28"
                    disabled={busy}
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {delaySeconds > 0
                    ? `Each lead sent ${delaySeconds}s apart — total ≈ ${Math.round((leads.length - 1) * delaySeconds)}s`
                    : 'Set a delay to stagger delivery (0 = send all immediately)'}
                </p>
              </div>
            )}

            {progress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Assigning {progress.current} of {progress.total}…</span>
                  {delaySeconds > 0 && (
                    <span>~{Math.round((progress.total - progress.current) * delaySeconds)}s remaining</span>
                  )}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter showCloseButton={!busy}>
          {busy ? (
            <Button variant="destructive" onClick={abort}>
              Stop
            </Button>
          ) : (
            <Button onClick={assign} disabled={!orderId || mixedTypes}>
              Assign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
