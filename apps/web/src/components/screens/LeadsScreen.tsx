'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Database,
  Eye,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { AssignLeadDialog } from '@/components/AssignLeadDialog';
import { EmptyState } from '@/components/EmptyState';
import { LeadDetailSheet } from '@/components/LeadDetailSheet';
import { MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { TableSkeleton } from '@/components/skeletons';
import { apiGet, apiSend } from '@/lib/proxy-client';

interface LeadRow {
  id: string;
  publicLeadId: string;
  leadType: string;
  state: string;
  rejectReason: string | null;
  capturedAt: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  zip: string | null;
  usState: string | null;
  landingPage: { id: string; name: string } | null;
  assignmentCount: number;
  latestAssignment: {
    id: string;
    deliveryStatus: string;
    deliveredAt: string | null;
    client: { id: string; full_name: string; business_name: string | null } | null;
    order: { id: string; public_order_id: string } | null;
  } | null;
}

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const STATES = ['UNSOLD_POOL', 'RESERVED', 'ASSIGNED', 'DELIVERED', 'REJECTED', 'REPLACED'];

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  UNSOLD_POOL: 'outline',
  RESERVED: 'secondary',
  ASSIGNED: 'secondary',
  DELIVERED: 'default',
  REJECTED: 'destructive',
  REPLACED: 'destructive',
};

const LEAD_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  SOLAR: 'default',
  SWEEPSTAKES: 'secondary',
  PAYDAY: 'outline',
  HOMEOWNER: 'outline',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Staff Leads browser — every lead in the system with filters + summary tiles. */
export function LeadsScreen() {
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Per-row selection — only UNSOLD_POOL leads are selectable for assign. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** When non-null, AssignLeadDialog is open targeting these leads. */
  const [assignTarget, setAssignTarget] = useState<LeadRow[] | null>(null);
  const [rematchBusy, setRematchBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    const params = new URLSearchParams({ limit: '300' });
    if (typeFilter !== 'ALL') params.set('lead_type', typeFilter);
    if (stateFilter !== 'ALL') params.set('state', stateFilter);
    try {
      const data = await apiGet<LeadRow[]>(`leads?${params.toString()}`);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    }
  }, [typeFilter, stateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.publicLeadId.toLowerCase().includes(q) ||
        (r.fullName?.toLowerCase().includes(q) ?? false) ||
        (r.email?.toLowerCase().includes(q) ?? false) ||
        (r.phone?.toLowerCase().includes(q) ?? false) ||
        (r.zip?.toLowerCase().includes(q) ?? false) ||
        (r.landingPage?.name.toLowerCase().includes(q) ?? false),
    );
  }, [rows, query]);

  // Eligible leads for the bulk-assign action — only those still in the pool.
  const assignable = useMemo(
    () => (filtered ?? []).filter((r) => r.state === 'UNSOLD_POOL' && selected.has(r.id)),
    [filtered, selected],
  );
  const poolInView = useMemo(
    () => (filtered ?? []).filter((r) => r.state === 'UNSOLD_POOL'),
    [filtered],
  );
  const allPoolChecked =
    poolInView.length > 0 && poolInView.every((r) => selected.has(r.id));
  const somePoolChecked = poolInView.some((r) => selected.has(r.id)) && !allPoolChecked;

  function toggleAllPool(checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of poolInView) {
        if (checked) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Auto-rematch — sweeps the UNSOLD_POOL against current orders. */
  async function matchPool(): Promise<void> {
    setRematchBusy(true);
    try {
      const result = await apiSend<{
        scanned: number;
        assigned: number;
        stillUnsold: number;
        assignmentCount: number;
      }>('POST', 'distribution/match-pool', {});
      await load();
      toast.success(
        `Scanned ${result.scanned} pooled lead${result.scanned === 1 ? '' : 's'}: ${result.assigned} assigned (${result.assignmentCount} assignment${result.assignmentCount === 1 ? '' : 's'}), ${result.stillUnsold} still unsold.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Pool rematch failed');
    } finally {
      setRematchBusy(false);
    }
  }

  /** Re-run the auto matcher for a single lead — useful after editing orders. */
  async function redistributeOne(lead: LeadRow): Promise<void> {
    try {
      await apiSend('POST', `distribution/leads/${lead.id}/distribute`, {});
      await load();
      toast.success(`Redistribution attempted for ${lead.publicLeadId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Redistribute failed');
    }
  }

  // Summary tiles use the *unfiltered* rows so they describe what's actually
  // in the system, not the current search subset.
  const totals = useMemo(() => {
    if (!rows) return null;
    return {
      total: rows.length,
      pool: rows.filter((r) => r.state === 'UNSOLD_POOL').length,
      delivered: rows.filter((r) => r.state === 'DELIVERED').length,
      rejected: rows.filter((r) => r.state === 'REJECTED').length,
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Leads"
        description="Every lead captured through your landing pages — ready to sell, delivered, or rejected."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={matchPool}
            disabled={rematchBusy}
            title="Re-run the auto matcher against every UNSOLD_POOL lead"
          >
            {rematchBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Match unsold pool
          </Button>
        }
      />

      {totals && (
        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Captured"
            value={totals.total.toLocaleString()}
            hint="In the current view window."
            icon={Database}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            label="Unsold pool"
            value={totals.pool.toLocaleString()}
            hint="Available to match a new order."
          />
          <StatCard
            label="Delivered"
            value={totals.delivered.toLocaleString()}
            hint="Acknowledged by the buying client."
          />
          <StatCard
            label="Rejected"
            value={totals.rejected.toLocaleString()}
            hint="Failed validation or matched suppression."
          />
        </section>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="search"
          placeholder="Search by lead id, name, email, phone, zip…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'ALL')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {LEAD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={(v) => setStateFilter(v ?? 'ALL')}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All states</SelectItem>
              {STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.toLowerCase().replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">
            {selected.size} selected
            {assignable.length < selected.size && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({assignable.length} eligible for assign)
              </span>
            )}
          </span>
          <span className="flex-1" />
          <Button
            type="button"
            size="sm"
            onClick={() => setAssignTarget(assignable)}
            disabled={assignable.length === 0}
          >
            <UserPlus className="size-3.5" />
            Assign to order…
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <TableSkeleton columns={9} rows={8} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : filtered && filtered.length === 0 ? (
            <EmptyState
              icon={Database}
              title={query || typeFilter !== 'ALL' || stateFilter !== 'ALL' ? 'No matches' : 'No leads yet'}
              description={
                query || typeFilter !== 'ALL' || stateFilter !== 'ALL'
                  ? 'Try a different search or clear the filters.'
                  : 'New leads will show up here the moment your landing pages receive submissions.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPoolChecked}
                      indeterminate={somePoolChecked}
                      onCheckedChange={(c) => toggleAllPool(c === true)}
                      aria-label="Select all unsold-pool leads in view"
                      disabled={poolInView.length === 0}
                    />
                  </TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Geo</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((r) => (
                  <TableRow
                    key={r.id}
                    data-state={selected.has(r.id) ? 'selected' : undefined}
                    className="group"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        disabled={r.state !== 'UNSOLD_POOL'}
                        aria-label={`Select ${r.publicLeadId}`}
                      />
                    </TableCell>
                    <TableCell
                      className="cursor-pointer text-xs text-muted-foreground tabular-nums hover:text-foreground"
                      title={new Date(r.capturedAt).toLocaleString()}
                      onClick={() => setSelectedId(r.id)}
                    >
                      {formatTime(r.capturedAt)}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer font-mono text-xs hover:text-primary"
                      onClick={() => setSelectedId(r.id)}
                    >
                      {r.publicLeadId}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LEAD_TYPE_VARIANT[r.leadType] ?? 'outline'}>
                        {r.leadType.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.fullName ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-0.5">
                        {r.email && (
                          <a
                            href={`mailto:${r.email}`}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Mail className="size-3.5" />
                            <span className="truncate">{r.email}</span>
                          </a>
                        )}
                        {r.phone && (
                          <a
                            href={`tel:${r.phone}`}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="size-3.5" />
                            {r.phone}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.zip || r.usState
                        ? [r.zip, r.usState].filter(Boolean).join(' · ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={STATE_VARIANT[r.state] ?? 'outline'}>
                          {r.state.toLowerCase().replace('_', ' ')}
                        </Badge>
                        {r.rejectReason && (
                          <span className="text-xs text-muted-foreground">
                            {r.rejectReason.toLowerCase().replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.latestAssignment?.client ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate">
                            {r.latestAssignment.client.business_name ??
                              r.latestAssignment.client.full_name}
                          </span>
                          {r.latestAssignment.order && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.latestAssignment.order.public_order_id}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Lead actions"
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setSelectedId(r.id)}>
                            <Eye className="size-3.5" />
                            View detail
                          </DropdownMenuItem>
                          {r.state === 'UNSOLD_POOL' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setAssignTarget([r])}
                              >
                                <UserPlus className="size-3.5" />
                                Assign to order…
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void redistributeOne(r)}
                              >
                                <RefreshCw className="size-3.5" />
                                Re-run auto match
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeadDetailSheet
        leadId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />

      <AssignLeadDialog
        open={assignTarget !== null}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        leads={
          assignTarget?.map((r) => ({
            id: r.id,
            publicLeadId: r.publicLeadId,
            leadType: r.leadType,
            fullName: r.fullName,
          })) ?? []
        }
        onDone={() => {
          setSelected(new Set());
          void load();
        }}
      />
    </div>
  );
}
