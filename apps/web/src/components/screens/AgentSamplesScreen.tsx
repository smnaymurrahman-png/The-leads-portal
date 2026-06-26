'use client';

import { useState } from 'react';
import { Check, FlaskConical, Loader2, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  FORWARDED: 'default',
  ASSIGNED: 'default',
  REJECTED: 'destructive',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'FORWARDED') {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
        forwarded
      </Badge>
    );
  }
  if (status === 'ASSIGNED') {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
        assigned
      </Badge>
    );
  }
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
      {status.toLowerCase()}
    </Badge>
  );
}

interface SampleRequestRow {
  id: string;
  public_id: string;
  lead_type: string;
  quantity: number;
  delivery_mode: string;
  status: string;
  reject_reason: string | null;
  notes: string | null;
  created_at: string;
  client: { id: string; full_name: string; business_name: string | null; email: string } | null;
  agent: { id: string; full_name: string; work_email: string } | null;
  _count: { deliveries: number };
}

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export function AgentSamplesScreen() {
  const { data: requests, loading, error, reload } = useResource<SampleRequestRow>('samples/requests');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SampleRequestRow | null>(null);

  async function forward(id: string): Promise<void> {
    setBusyId(id);
    try {
      await apiSend('PATCH', `samples/requests/${id}/forward`, {});
      await reload();
      toast.success('Request forwarded to admin');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  function rowActions(r: SampleRequestRow) {
    const busy = busyId === r.id;
    if (r.status === 'PENDING') {
      return (
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void forward(r.id)}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Forward
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setRejectTarget(r)}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      );
    }
    if (r.status === 'FORWARDED') {
      return <span className="text-xs text-muted-foreground">Awaiting admin</span>;
    }
    if (r.status === 'ASSIGNED') {
      return (
        <span className="text-xs text-green-600 dark:text-green-400">
          {r._count.deliveries} lead{r._count.deliveries !== 1 ? 's' : ''} delivered
        </span>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Samples"
        description="Review sample requests from your clients, forward to admin for fulfillment."
      />

      <Tabs defaultValue="requests">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">Client Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : error ? (
                <p className="px-6 py-12 text-sm text-destructive">{error}</p>
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No sample requests"
                  description="Sample requests from your clients will appear here for your review."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.public_id}</TableCell>
                        <TableCell className="text-sm">
                          {r.client?.business_name ?? r.client?.full_name ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {r.lead_type.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={r.status} />
                            {r.reject_reason && (
                              <span className="text-xs text-muted-foreground">{r.reject_reason}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {dateTime(r.created_at)}
                        </TableCell>
                        <TableCell>{rowActions(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {rejectTarget && (
        <RejectDialog
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function RejectDialog({
  request,
  onClose,
  onDone,
}: {
  request: SampleRequestRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await apiSend('PATCH', `samples/requests/${request.id}/reject`, {
        reason: reason.trim() || undefined,
      });
      toast.success('Request rejected');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject sample request</DialogTitle>
          <DialogDescription>
            Request {request.public_id} from{' '}
            {request.client?.business_name ?? request.client?.full_name ?? 'client'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
          />
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter showCloseButton>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void handle()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
