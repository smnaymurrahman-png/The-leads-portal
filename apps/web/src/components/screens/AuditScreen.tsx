'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Lock,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
} from 'lucide-react';
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
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { apiGet } from '@/lib/proxy-client';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  before: unknown;
  after: unknown;
  actor: { id: string; full_name: string; role: string } | null;
}

interface ListResponse {
  rows: AuditRow[];
  nextCursor: string | null;
}

interface SummaryResponse {
  total: number;
  actions: { action: string; count: number }[];
  actors: { id: string; name: string; role: string }[];
}

interface Filters {
  actions: string[];
  actor_user_id: string;
  from: string;
  to: string;
  q: string;
}

const EMPTY_FILTERS: Filters = {
  actions: [],
  actor_user_id: '',
  from: '',
  to: '',
  q: '',
};

// ── Quick filter chips (curated sets of action names) ────────────────────────

interface QuickFilter {
  id: string;
  label: string;
  match: (action: string) => boolean;
  tone: string;
  icon?: typeof Lock;
}

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'all', label: 'All', match: () => true, tone: 'bg-muted text-foreground' },
  {
    id: 'pii',
    label: 'PII reveals',
    match: (a) => a === 'LEAD_PII_REVEAL',
    tone: 'bg-rose-100 text-rose-800',
    icon: Lock,
  },
  {
    id: 'columns',
    label: 'Column changes',
    match: (a) => a.startsWith('LEAD_COLUMN_'),
    tone: 'bg-violet-100 text-violet-800',
  },
  {
    id: 'orders',
    label: 'Order decisions',
    match: (a) => a.startsWith('ORDER_'),
    tone: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'followup',
    label: 'Follow-up',
    match: (a) => a === 'LEAD_FOLLOWUP_UPDATE',
    tone: 'bg-emerald-100 text-emerald-800',
  },
];

function actionTone(action: string): string {
  if (action === 'LEAD_PII_REVEAL') return 'bg-rose-100 text-rose-800';
  if (action.startsWith('LEAD_COLUMN_')) return 'bg-violet-100 text-violet-800';
  if (action.startsWith('ORDER_')) return 'bg-blue-100 text-blue-800';
  if (action === 'LEAD_FOLLOWUP_UPDATE') return 'bg-emerald-100 text-emerald-800';
  return 'bg-muted text-foreground';
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  SUPER_ADMIN: 'default',
  ADMIN: 'secondary',
  AGENT: 'outline',
  CLIENT: 'outline',
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function buildQuery(filters: Filters, cursor?: string | null, limit?: number): string {
  const sp = new URLSearchParams();
  if (filters.actions.length) sp.set('actions', filters.actions.join(','));
  if (filters.actor_user_id) sp.set('actor_user_id', filters.actor_user_id);
  if (filters.from) sp.set('from', new Date(filters.from).toISOString());
  if (filters.to) {
    const end = new Date(filters.to);
    end.setUTCHours(23, 59, 59, 999);
    sp.set('to', end.toISOString());
  }
  if (filters.q) sp.set('q', filters.q);
  if (cursor) sp.set('cursor', cursor);
  if (limit) sp.set('limit', String(limit));
  return sp.toString();
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function AuditScreen() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(filters, null, 100);
      const [list, sum] = await Promise.all([
        apiGet<ListResponse>(`audit?${qs}`),
        apiGet<SummaryResponse>(`audit/summary?${qs}`),
      ]);
      setRows(list.rows);
      setNextCursor(list.nextCursor);
      setSummary(sum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const more = await apiGet<ListResponse>(`audit?${buildQuery(filters, nextCursor, 100)}`);
      setRows((rs) => [...rs, ...more.rows]);
      setNextCursor(more.nextCursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoadingMore(false);
    }
  };

  const applyQuickFilter = (qf: QuickFilter) => {
    if (qf.id === 'all') {
      setFilters((f) => ({ ...f, actions: [] }));
      return;
    }
    const knownActions = summary?.actions.map((a) => a.action) ?? [];
    const matching = knownActions.filter(qf.match);
    setFilters((f) => ({
      ...f,
      actions: matching.length ? matching : qf.id === 'pii' ? ['LEAD_PII_REVEAL'] : [qf.label],
    }));
  };

  const activeQuickId = useMemo<string>(() => {
    if (filters.actions.length === 0) return 'all';
    if (filters.actions.length === 1 && filters.actions[0] === 'LEAD_PII_REVEAL') return 'pii';
    if (filters.actions.every((a) => a.startsWith('LEAD_COLUMN_'))) return 'columns';
    if (filters.actions.every((a) => a.startsWith('ORDER_'))) return 'orders';
    if (filters.actions.length === 1 && filters.actions[0] === 'LEAD_FOLLOWUP_UPDATE') return 'followup';
    return 'custom';
  }, [filters.actions]);

  const piiInView = useMemo(
    () => rows.filter((r) => r.action === 'LEAD_PII_REVEAL').length,
    [rows],
  );

  const reset = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Super Admin"
        title="Audit log"
        description="Every PII reveal, order decision, column edit and replacement review — kept forever."
      />

      {piiInView > 0 && (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 shrink-0" />
            <div>
              <p className="font-medium">
                {piiInView} sensitive data {piiInView === 1 ? 'reveal' : 'reveals'} in this view
              </p>
              <p className="text-rose-700/80">
                These rows record every time SSN, routing or account numbers were decrypted —
                expand a row for the exact fields and the principal that did it.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.id}
              onClick={() => applyQuickFilter(qf)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                activeQuickId === qf.id
                  ? cn(qf.tone, 'border-transparent shadow-sm')
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {qf.icon ? <qf.icon className="size-3" /> : null}
              {qf.label}
              {summary && qf.id !== 'all' && (
                <span className="text-[10px] opacity-70">
                  {summary.actions.filter((a) => qf.match(a.action)).reduce((n, a) => n + a.count, 0)}
                </span>
              )}
            </button>
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Entity ID…"
                className="h-9 w-48 pl-8"
              />
            </div>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="h-9 w-36"
              aria-label="From date"
            />
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="h-9 w-36"
              aria-label="To date"
            />
            <Select
              value={filters.actor_user_id || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, actor_user_id: v === 'all' || !v ? '' : v }))
              }
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="Any actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any actor</SelectItem>
                {(summary?.actors ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({a.role.toLowerCase()})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={reset} disabled={loading}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Filter className="size-3" />
          {summary ? (
            <>
              <span>{summary.total} matching events</span>
              <span>·</span>
              <span>{rows.length} loaded</span>
            </>
          ) : (
            <span>loading…</span>
          )}
        </div>
        <span data-now={now}>
          {rows.length > 0 ? `latest ${relativeTime(rows[0].created_at)}` : ''}
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={5} rows={8} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No matching events"
              description="Try widening the date range, clearing the actor filter, or picking a different quick-filter chip."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2 text-left" />
                  <th className="w-32 px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isExpanded = expanded.has(row.id);
                  const isPii = row.action === 'LEAD_PII_REVEAL';
                  return (
                    <RowGroup
                      key={row.id}
                      row={row}
                      isExpanded={isExpanded}
                      isPii={isPii}
                      onToggle={() =>
                        setExpanded((s) => {
                          const next = new Set(s);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        })
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {nextCursor && rows.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Row + expanded detail ────────────────────────────────────────────────────

interface RowGroupProps {
  row: AuditRow;
  isExpanded: boolean;
  isPii: boolean;
  onToggle: () => void;
}

function RowGroup({ row, isExpanded, isPii, onToggle }: RowGroupProps) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer border-t border-border hover:bg-muted/30',
          isPii && 'bg-rose-50/40',
        )}
      >
        <td className="px-3 py-2 text-muted-foreground">
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </td>
        <td
          className="px-3 py-2 text-xs text-muted-foreground"
          title={new Date(row.created_at).toLocaleString()}
        >
          {relativeTime(row.created_at)}
        </td>
        <td className="px-3 py-2">
          {row.actor ? (
            <div className="flex items-center gap-2">
              <span>{row.actor.full_name}</span>
              <Badge variant={ROLE_VARIANT[row.actor.role] ?? 'outline'}>
                {row.actor.role.toLowerCase().replace('_', ' ')}
              </Badge>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">system</span>
          )}
        </td>
        <td className="px-3 py-2 font-medium">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
              actionTone(row.action),
            )}
          >
            {isPii && <Lock className="size-3" />}
            {row.action}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-muted-foreground">{row.entity}</td>
        <td className="px-3 py-2">
          <code className="text-xs text-muted-foreground">{row.entity_id ?? '—'}</code>
        </td>
      </tr>
      {isExpanded && (
        <tr className={cn('border-t border-border bg-muted/10', isPii && 'bg-rose-50/30')}>
          <td className="px-3 py-3" />
          <td colSpan={5} className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DiffBlock label="Before" data={row.before} />
              <DiffBlock label="After" data={row.after} highlight={isPii} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DiffBlock({
  label,
  data,
  highlight,
}: {
  label: string;
  data: unknown;
  highlight?: boolean;
}) {
  const json = useMemo(
    () => (data === null || data === undefined ? '—' : JSON.stringify(data, null, 2)),
    [data],
  );
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <pre
        className={cn(
          'max-h-64 overflow-auto rounded border border-border bg-card p-3 font-mono text-xs',
          highlight && 'border-rose-200 bg-rose-50/40',
        )}
      >
        {json}
      </pre>
    </div>
  );
}
