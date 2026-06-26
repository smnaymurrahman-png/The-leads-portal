'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { apiGet, apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

// ── Types ────────────────────────────────────────────────────────────────────

interface PoolLead {
  id: string;
  public_lead_id: string;
  lead_type: string;
  lead_state: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  zip: string | null;
  captured_at: string;
  in_sample_pool: boolean;
}

interface SampleRequestRow {
  id: string;
  public_id: string;
  lead_type: string;
  quantity: number;
  delivery_mode: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
  client: { id: string; full_name: string; business_name: string | null; email: string } | null;
  agent: { id: string; full_name: string; work_email: string } | null;
  reviewer: { id: string; full_name: string } | null;
  _count: { deliveries: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const STATUS_FILTER_OPTIONS = ['ALL', 'PENDING', 'FORWARDED', 'ASSIGNED', 'REJECTED'] as const;

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
  if (status === 'REJECTED') {
    return <Badge variant="destructive">rejected</Badge>;
  }
  return <Badge variant="secondary">{status.toLowerCase()}</Badge>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminSamplesScreen() {
  const { data: pool, loading: poolLoading, error: poolError, reload: reloadPool } =
    useResource<PoolLead>('samples/pool');
  const { data: requests, loading: reqLoading, error: reqError, reload: reloadReqs } =
    useResource<SampleRequestRow>('samples/requests');

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [leadIdInput, setLeadIdInput] = useState('');
  const [addingToPool, setAddingToPool] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [assignTarget, setAssignTarget] = useState<SampleRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SampleRequestRow | null>(null);

  const filteredRequests =
    statusFilter === 'ALL' ? requests : requests.filter((r) => r.status === statusFilter);

  async function addToPool(): Promise<void> {
    const id = leadIdInput.trim();
    if (!id) return;
    setAddingToPool(true);
    try {
      await apiSend('POST', `samples/pool/${id}`, {});
      setLeadIdInput('');
      await reloadPool();
      toast.success('Lead added to sample pool');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add lead');
    } finally {
      setAddingToPool(false);
    }
  }

  async function removeFromPool(leadId: string): Promise<void> {
    setRemovingId(leadId);
    try {
      await fetch(`/api/proxy/samples/pool/${leadId}`, { method: 'DELETE' });
      await reloadPool();
      toast.success('Lead removed from sample pool');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove lead');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Samples"
        description="Manage the sample lead pool and review incoming sample requests."
      />

      <Tabs defaultValue="pool">
        <TabsList className="mb-4">
          <TabsTrigger value="pool">Sample Pool</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        {/* ── Pool tab ── */}
        <TabsContent value="pool">
          <div className="mb-4 flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Lead UUID to add to pool…"
              value={leadIdInput}
              onChange={(e) => setLeadIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addToPool();
              }}
            />
            <Button
              type="button"
              disabled={addingToPool || !leadIdInput.trim()}
              onClick={() => void addToPool()}
            >
              {addingToPool ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add to pool
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {poolLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : poolError ? (
                <p className="px-6 py-12 text-sm text-destructive">{poolError}</p>
              ) : pool.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="Sample pool is empty"
                  description="Add leads to the pool by entering their ID above."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Captured</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pool.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-mono text-xs">{lead.public_lead_id}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {lead.lead_type.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-sm">{lead.full_name ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lead.email ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">{lead.state ?? '—'}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {dateTime(lead.captured_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={removingId === lead.id}
                            onClick={() => void removeFromPool(lead.id)}
                          >
                            {removingId === lead.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Minus className="size-3.5" />
                            )}
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Requests tab ── */}
        <TabsContent value="requests">
          <div className="mb-4">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'ALL')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'ALL' ? 'All statuses' : s.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {reqLoading ? (
                <TableSkeleton columns={8} rows={5} />
              ) : reqError ? (
                <p className="px-6 py-12 text-sm text-destructive">{reqError}</p>
              ) : filteredRequests.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No sample requests"
                  description="Sample requests forwarded by agents will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.public_id}</TableCell>
                        <TableCell className="text-sm">
                          {r.client?.business_name ?? r.client?.full_name ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.agent?.full_name ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {r.lead_type.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {r.delivery_mode.toLowerCase()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={r.status} />
                            {r.reject_reason && (
                              <span className="text-xs text-muted-foreground">
                                {r.reject_reason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {dateTime(r.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            {['PENDING', 'FORWARDED'].includes(r.status) && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setAssignTarget(r)}
                                >
                                  Assign
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRejectTarget(r)}
                                >
                                  <X className="size-3.5" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {r.status === 'ASSIGNED' && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {r._count.deliveries}/{r.quantity} assigned
                              </span>
                            )}
                            {r.status === 'REJECTED' && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {assignTarget && (
        <AssignDialog
          request={assignTarget}
          pool={pool}
          onClose={() => setAssignTarget(null)}
          onDone={() => {
            setAssignTarget(null);
            void reloadReqs();
          }}
        />
      )}

      {rejectTarget && (
        <RejectDialog
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            void reloadReqs();
          }}
        />
      )}
    </div>
  );
}

// ── AssignDialog ──────────────────────────────────────────────────────────────

function AssignDialog({
  request,
  pool,
  onClose,
  onDone,
}: {
  request: SampleRequestRow;
  pool: PoolLead[];
  onClose: () => void;
  onDone: () => void;
}) {
  const matchingLeads = pool.filter((l) => l.lead_type === request.lead_type);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clientId, setClientId] = useState(request.client?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < request.quantity) {
        next.add(id);
      } else {
        toast.error(`Maximum ${request.quantity} leads can be selected`);
      }
      return next;
    });
  }

  async function handle(): Promise<void> {
    if (selectedIds.size === 0) {
      setError('Select at least one lead to assign');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend('POST', `samples/requests/${request.id}/assign`, {
        lead_ids: [...selectedIds],
        client_id: clientId || undefined,
      });
      toast.success('Leads assigned successfully');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign sample leads</DialogTitle>
          <DialogDescription>
            Request {request.public_id} · {request.lead_type.toLowerCase()} · up to{' '}
            {request.quantity} leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Assign to client
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (defaults to requesting client)
              </span>
            </label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Client UUID (leave blank to use requesting client)"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Select leads from pool
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({selectedIds.size}/{request.quantity} selected)
              </span>
            </p>
            {matchingLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {request.lead_type.toLowerCase()} leads in the pool.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                {matchingLeads.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs">{lead.public_lead_id}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.full_name ?? lead.email ?? lead.state ?? '—'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{lead.state ?? ''}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            disabled={busy || selectedIds.size === 0}
            onClick={() => void handle()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? 'Assigning…' : `Assign ${selectedIds.size || ''} lead${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── RejectDialog ──────────────────────────────────────────────────────────────

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
