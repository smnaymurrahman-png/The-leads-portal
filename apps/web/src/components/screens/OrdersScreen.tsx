'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Ban, Check, FileText, Loader2, Receipt, ShoppingCart, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { usePromptDialog } from '@/components/PromptDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { num, opt, str } from '@/lib/form';
import { apiGet, apiSend, apiUpload } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const DELIVERY_MODES = ['EXCLUSIVE', 'SHARED'];

const PAYMENT_METHODS = ['BANK_TRANSFER', 'MOBILE_WALLET', 'CASH', 'CHECK', 'OTHER'] as const;
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  MOBILE_WALLET: 'Mobile wallet',
  CASH: 'Cash',
  CHECK: 'Check',
  OTHER: 'Other',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline',
  AWAITING_PAYMENT: 'outline',
  PROOF_SUBMITTED: 'secondary',
  ACTIVE: 'default',
  FULFILLING: 'default',
  COMPLETED: 'secondary',
  REJECTED: 'destructive',
  PAUSED: 'outline',
  CANCELLED: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'draft',
  AWAITING_PAYMENT: 'awaiting payment',
  PROOF_SUBMITTED: 'proof submitted',
  ACTIVE: 'active',
  FULFILLING: 'fulfilling',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
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
  requirements: string | null;
  needed_by: string | null;
  reject_note: string | null;
  cancelled_reason: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  payment_uploaded_at: string | null;
  payment_screenshot_filename: string | null;
  client: {
    id: string;
    full_name: string;
    business_name: string | null;
    email: string;
    agent_id: string;
  } | null;
}

const money = (n: string | number): string =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * Order lifecycle screen (off-platform / WhatsApp payment flow).
 *   CLIENT  — places requests, then pays their agent off-platform.
 *   AGENT   — uploads the payment screenshot, may cancel uncollected orders.
 *   ADMIN   — reviews the screenshot and accepts (activates) or rejects.
 */
export function OrdersScreen({ role }: { role: string }) {
  const isClient = role === 'CLIENT';
  const isAgent = role === 'AGENT';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: orders, loading, error, reload } = useResource<OrderRow>('orders');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<OrderRow | null>(null);
  const [reviewTarget, setReviewTarget] = useState<OrderRow | null>(null);
  const [askReason, promptMount] = usePromptDialog();

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const neededLocal = opt(fd.get('needed_by'));
    const needed_by = neededLocal ? new Date(neededLocal).toISOString() : undefined;

    await apiSend('POST', 'orders', {
      lead_type: str(fd.get('lead_type')),
      delivery_mode: str(fd.get('delivery_mode')),
      quantity: num(fd.get('quantity')),
      criteria: {},
      ...(opt(fd.get('requirements')) ? { requirements: opt(fd.get('requirements')) } : {}),
      ...(needed_by ? { needed_by } : {}),
    });
    await reload();
    toast.success('Order submitted — your agent will reach out to collect payment.');
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
      description: 'The client and their agent will see this note next to the rejected status.',
      label: 'Reason',
      placeholder: "Why is the order being rejected? (won't be sent without a note)",
      confirmLabel: 'Reject order',
      destructive: true,
    });
    if (note) {
      await runAction(id, 'reject', { reject_note: note }, 'Order rejected');
    }
  }

  async function cancel(id: string): Promise<void> {
    const reason = await askReason({
      title: 'Cancel this order',
      description: 'Cancelling stops fulfilment. This cannot be undone.',
      label: 'Reason',
      placeholder: 'Why is the order being cancelled?',
      confirmLabel: 'Cancel order',
      destructive: true,
    });
    if (reason) {
      await runAction(id, 'cancel', { reason }, 'Order cancelled');
    }
  }

  function rowActions(o: OrderRow) {
    const busy = busyId === o.id;

    if (isAgent) {
      if (o.status === 'AWAITING_PAYMENT') {
        return (
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" disabled={busy} onClick={() => setUploadTarget(o)}>
              <Upload className="size-3.5" />
              Upload payment
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void cancel(o.id)}
            >
              <Ban className="size-3.5" />
              Cancel
            </Button>
          </div>
        );
      }
      if (o.status === 'PROOF_SUBMITTED') {
        return <span className="text-xs text-muted-foreground">Awaiting admin review</span>;
      }
      return <span className="text-muted-foreground">—</span>;
    }

    if (isAdmin) {
      if (o.status === 'PROOF_SUBMITTED') {
        return (
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" disabled={busy} onClick={() => setReviewTarget(o)}>
              <Receipt className="size-3.5" />
              Review payment
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void cancel(o.id)}
            >
              <Ban className="size-3.5" />
              Cancel
            </Button>
          </div>
        );
      }
      if (o.status === 'AWAITING_PAYMENT') {
        return (
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void reject(o.id)}
            >
              <X className="size-3.5" />
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void cancel(o.id)}
            >
              <Ban className="size-3.5" />
              Cancel
            </Button>
          </div>
        );
      }
      if (o.status === 'ACTIVE' || o.status === 'FULFILLING' || o.status === 'PAUSED') {
        return (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void cancel(o.id)}
            >
              <Ban className="size-3.5" />
              Cancel
            </Button>
          </div>
        );
      }
      return <span className="text-muted-foreground">—</span>;
    }

    // CLIENT
    if (o.status === 'AWAITING_PAYMENT') {
      return (
        <span className="text-xs text-muted-foreground">Pay your agent to activate</span>
      );
    }
    if (o.status === 'PROOF_SUBMITTED') {
      return <span className="text-xs text-muted-foreground">Verifying payment…</span>;
    }
    return <span className="text-muted-foreground">—</span>;
  }

  const columnCount = isClient ? 9 : 10;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description={
          isClient
            ? 'Request leads, then pay your agent off-platform. Orders activate once an admin verifies the payment.'
            : isAgent
              ? "Your clients' orders. Upload the payment screenshot once a client pays you."
              : isAdmin
                ? 'Review submitted payment proofs, then accept to activate the order or reject with a note.'
                : 'Orders placed by your clients.'
        }
        actions={
          isClient ? (
            <FormDialog
              triggerLabel="Place order"
              title="Request an order"
              description="Submit a request — your agent collects payment, then an admin activates it."
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
                  <Input name="quantity" type="number" min={1} defaultValue={10} required />
                </Field>
                <Field label="When are the leads needed?" hint="optional">
                  <Input name="needed_by" type="datetime-local" />
                </Field>
                <Field label="Requirements" hint="optional" className="sm:col-span-2">
                  <Textarea
                    name="requirements"
                    rows={5}
                    placeholder="Describe what you're looking for — targeting notes, delivery preferences, anything the team should know."
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
            <TableSkeleton columns={columnCount} rows={6} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders yet"
              description={
                isClient
                  ? 'Place an order to start receiving leads. Your agent collects payment off-platform.'
                  : isAgent
                    ? "Your clients' orders will appear here. Upload payment proof once they pay."
                    : isAdmin
                      ? 'Submitted payment proofs will land here for you to review.'
                      : "Your clients' orders will appear here as they're placed."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  {!isClient && <TableHead>Client</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Needed by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.public_order_id}</TableCell>
                    {!isClient && (
                      <TableCell className="text-sm">
                        {o.client?.business_name ?? o.client?.full_name ?? '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-sm capitalize">{o.lead_type.toLowerCase()}</TableCell>
                    <TableCell className="text-sm capitalize">
                      {o.delivery_mode.toLowerCase()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.quantity_paid}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.quantity_remaining}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(o.total_amount)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {o.needed_by ? dateTime(o.needed_by) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
                          {STATUS_LABEL[o.status] ?? o.status.toLowerCase()}
                        </Badge>
                        {o.reject_note && (
                          <span className="text-xs text-muted-foreground">{o.reject_note}</span>
                        )}
                        {o.cancelled_reason && (
                          <span className="text-xs text-muted-foreground">
                            {o.cancelled_reason}
                          </span>
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

      {uploadTarget && (
        <UploadProofDialog
          order={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onDone={() => {
            setUploadTarget(null);
            void reload();
          }}
        />
      )}

      {reviewTarget && (
        <ReviewPaymentDialog
          order={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onDone={() => {
            setReviewTarget(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

/** Agent uploads the WhatsApp payment screenshot for an AWAITING_PAYMENT order. */
function UploadProofDialog({
  order,
  onClose,
  onDone,
}: {
  order: OrderRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a payment screenshot to upload.');
      return;
    }
    // Drop empty optional text fields so they don't post as blank strings.
    for (const key of ['payment_reference', 'payment_note']) {
      if (!fd.get(key)) fd.delete(key);
    }
    setSaving(true);
    setError(null);
    try {
      await apiUpload(`orders/${order.id}/payment-proof`, fd);
      toast.success('Payment proof submitted for review');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload payment proof</DialogTitle>
          <DialogDescription>
            Order {order.public_order_id} · {money(order.total_amount)} for{' '}
            {order.client?.business_name ?? order.client?.full_name ?? 'this client'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <Field label="Screenshot" hint="image or PDF">
            <Input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Method" hint="optional">
              <Select name="payment_method" defaultValue="BANK_TRANSFER">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference" hint="optional">
              <Input name="payment_reference" placeholder="Txn id / sender / last 4" />
            </Field>
          </div>
          <Field label="Note" hint="optional">
            <Textarea
              name="payment_note"
              rows={3}
              placeholder="e.g. $200 confirmed via bank transfer, sender John Doe."
            />
          </Field>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {saving ? 'Uploading…' : 'Submit proof'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ProofMeta {
  src: string;
  mime: string | null;
  filename: string | null;
}

/** Admin reviews the uploaded screenshot, then accepts or rejects the order. */
function ReviewPaymentDialog({
  order,
  onClose,
  onDone,
}: {
  order: OrderRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [proof, setProof] = useState<ProofMeta | null>(null);
  const [loadingProof, setLoadingProof] = useState(true);
  const [proofError, setProofError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingProof(true);
    setProofError(null);
    void (async () => {
      try {
        const res = await apiGet<{ url: string; mime: string | null; filename: string | null }>(
          `orders/${order.id}/payment-proof-url`,
        );
        if (!active) return;
        // The signed URL is an API path (`/api/orders/...`). Route it through
        // the proxy so the browser can load it with the session cookie.
        const proxied = `/api/proxy/${res.url.replace(/^\/api\//, '')}`;
        setProof({ src: proxied, mime: res.mime, filename: res.filename });
      } catch (e) {
        if (active) setProofError(e instanceof Error ? e.message : 'Failed to load proof');
      } finally {
        if (active) setLoadingProof(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [order.id]);

  async function accept(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await apiSend('POST', `orders/${order.id}/accept`, {});
      toast.success('Payment verified — order activated and invoiced.');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed');
      setBusy(false);
    }
  }

  async function confirmReject(): Promise<void> {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend('POST', `orders/${order.id}/reject`, { reject_note: note.trim() });
      toast.success('Order rejected');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
      setBusy(false);
    }
  }

  const isImage = proof?.mime?.startsWith('image/') ?? false;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review payment</DialogTitle>
          <DialogDescription>
            Order {order.public_order_id} · {money(order.total_amount)} ·{' '}
            {order.client?.business_name ?? order.client?.full_name ?? 'client'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Method</dt>
            <dd>{order.payment_method ? PAYMENT_METHOD_LABEL[order.payment_method] : '—'}</dd>
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="truncate">{order.payment_reference ?? '—'}</dd>
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd>{order.payment_uploaded_at ? dateTime(order.payment_uploaded_at) : '—'}</dd>
          </dl>
          {order.payment_note && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {order.payment_note}
            </p>
          )}

          <div className="overflow-hidden rounded-lg border">
            {loadingProof ? (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : proofError ? (
              <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-destructive">
                {proofError}
              </div>
            ) : proof && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proof.src} alt="Payment screenshot" className="max-h-80 w-full object-contain" />
            ) : proof ? (
              <a
                href={proof.src}
                target="_blank"
                rel="noreferrer noopener"
                className="flex h-32 items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="size-4" />
                Open {proof.filename ?? 'payment proof'}
              </a>
            ) : null}
          </div>

          {rejecting && (
            <Textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for rejection — shown to the client and their agent."
            />
          )}
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter showCloseButton>
          {rejecting ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy || note.trim().length === 0}
              onClick={() => void confirmReject()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Confirm reject
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRejecting(true)}
              >
                <X className="size-4" />
                Reject
              </Button>
              <Button type="button" disabled={busy || loadingProof} onClick={() => void accept()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Accept &amp; activate
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
