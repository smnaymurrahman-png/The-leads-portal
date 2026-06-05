'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { AssignLeadDialog } from '@/components/AssignLeadDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { apiGet, apiSend } from '@/lib/proxy-client';
import { cn } from '@/lib/utils';

// ── API contract ──────────────────────────────────────────────────────────────

type LeadType = 'SOLAR' | 'SWEEPSTAKES' | 'PAYDAY' | 'HOMEOWNER';
type FollowupStatus = 'NEW' | 'CALLED' | 'NO_ANSWER' | 'CONVERTED' | 'DEAD';

interface ColumnDef {
  id: string;
  field_key: string;
  position: number;
  label: string;
  source: string;
  data_type: string;
  sensitive: boolean;
  mask_kind: string | null;
  default_visible: boolean;
}

interface Cell {
  value: string | null;
  sensitive: boolean;
  raw?: string | null;
}

interface Row {
  assignmentId: string | null;
  leadId: string;
  publicLeadId: string;
  leadState: string;
  followupStatus: FollowupStatus;
  followupNote: string | null;
  followupUpdatedAt: string | null;
  values: Record<string, Cell>;
}

interface SheetPayload {
  leadType: LeadType;
  columns: ColumnDef[];
  rows: Row[];
  total: number;
  nextCursor: string | null;
}

// ── Visual helpers ────────────────────────────────────────────────────────────

const FOLLOWUP_OPTIONS: { value: FollowupStatus; label: string; tone: string }[] = [
  { value: 'NEW',       label: 'New',       tone: 'bg-muted text-muted-foreground' },
  { value: 'CALLED',    label: 'Called',    tone: 'bg-blue-100 text-blue-800' },
  { value: 'NO_ANSWER', label: 'No answer', tone: 'bg-amber-100 text-amber-800' },
  { value: 'CONVERTED', label: 'Converted', tone: 'bg-emerald-100 text-emerald-800' },
  { value: 'DEAD',      label: 'Dead',      tone: 'bg-rose-100 text-rose-800' },
];

/** Lead-state filter options for staff (server-side filter). */
const STATE_FILTERS = ['UNSOLD_POOL', 'ASSIGNED', 'DELIVERED', 'REJECTED', 'REPLACED'];

function followupTone(status: FollowupStatus): string {
  return FOLLOWUP_OPTIONS.find((o) => o.value === status)?.tone ?? FOLLOWUP_OPTIONS[0].tone;
}

function formatCellDisplay(value: string | null, dataType: string): string {
  if (!value) return '—';
  switch (dataType) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'datetime':
      return new Date(value).toLocaleString();
    default:
      return value;
  }
}

const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  SOLAR: 'Solar',
  SWEEPSTAKES: 'Sweepstakes',
  PAYDAY: 'Payday',
  HOMEOWNER: 'Homeowner',
};

/** Best-effort display name across the vertical-specific field keys. */
function rowName(row: Row): string | null {
  return (
    row.values['full_name']?.value ??
    row.values['fname']?.value ??
    row.values['first_name_01']?.value ??
    null
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export interface LeadsSheetScreenProps {
  leadType: LeadType;
  /** Whether the Follow-up cell is editable (CLIENT only). */
  editableFollowup?: boolean;
  /** Whether the caller may decrypt sensitive cells. */
  canReveal?: boolean;
  /** Staff (ADMIN/SUPER_ADMIN): show assignment controls + unassigned leads. */
  manage?: boolean;
}

export function LeadsSheetScreen({
  leadType,
  editableFollowup = false,
  canReveal = true,
  manage = false,
}: LeadsSheetScreenProps) {
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [sort, setSort]         = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reveal, setReveal]     = useState<{ row: Row; column: ColumnDef; plain: string | null } | null>(null);
  const [revealing, setRevealing] = useState(false);
  // Assignment (manage mode)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState<Row[] | null>(null);
  const [matchBusy, setMatchBusy] = useState(false);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = `lead_type=${leadType}&limit=500${
        manage && stateFilter !== 'ALL' ? `&state=${stateFilter}` : ''
      }`;
      const data = await apiGet<SheetPayload>(`leads/sheet?${qs}`);
      setPayload(data);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [leadType, manage, stateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-sort + free-text filter happen client-side over the loaded page.
  const visibleRows = useMemo(() => {
    if (!payload) return [] as Row[];
    let rows = payload.rows;
    if (filter.trim()) {
      const needle = filter.toLowerCase();
      rows = rows.filter((r) => {
        if (r.publicLeadId.toLowerCase().includes(needle)) return true;
        for (const cell of Object.values(r.values)) {
          if (cell.value && cell.value.toLowerCase().includes(needle)) return true;
        }
        return false;
      });
    }
    if (sort) {
      const { key, dir } = sort;
      const factor = dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a.values[key]?.value ?? '';
        const bv = b.values[key]?.value ?? '';
        if (av === bv) return 0;
        return av < bv ? -1 * factor : 1 * factor;
      });
    }
    return rows;
  }, [payload, filter, sort]);

  // Assignable = unsold pool leads, the ones a staff operator can assign.
  const assignableInView = useMemo(
    () => (manage ? visibleRows.filter((r) => r.leadState === 'UNSOLD_POOL') : []),
    [manage, visibleRows],
  );
  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected.has(r.leadId)),
    [visibleRows, selected],
  );
  const allAssignableSelected =
    assignableInView.length > 0 && assignableInView.every((r) => selected.has(r.leadId));
  const someAssignableSelected =
    assignableInView.some((r) => selected.has(r.leadId)) && !allAssignableSelected;

  const toggleSort = (key: string) =>
    setSort((s) =>
      !s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null,
    );

  function toggleRow(leadId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function toggleAllAssignable(checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of assignableInView) {
        if (checked) next.add(r.leadId);
        else next.delete(r.leadId);
      }
      return next;
    });
  }

  async function matchPool(): Promise<void> {
    setMatchBusy(true);
    try {
      const result = await apiSend<{
        scanned: number;
        assigned: number;
        stillUnsold: number;
        assignmentCount: number;
      }>('POST', 'distribution/match-pool', {});
      await load();
      toast.success(
        `Scanned ${result.scanned}: ${result.assigned} assigned (${result.assignmentCount} assignment${
          result.assignmentCount === 1 ? '' : 's'
        }), ${result.stillUnsold} still unsold.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Pool rematch failed');
    } finally {
      setMatchBusy(false);
    }
  }

  async function redistributeOne(row: Row): Promise<void> {
    setBusyLeadId(row.leadId);
    try {
      await apiSend('POST', `distribution/leads/${row.leadId}/distribute`, {});
      await load();
      toast.success(`Redistribution attempted for ${row.publicLeadId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Redistribute failed');
    } finally {
      setBusyLeadId(null);
    }
  }

  const handleFollowupChange = async (row: Row, next: FollowupStatus) => {
    if (!row.assignmentId) return;
    try {
      await apiSend('PATCH', `lead-assignments/${row.assignmentId}/followup`, { status: next });
      setPayload((p) =>
        p
          ? {
              ...p,
              rows: p.rows.map((r) =>
                r.leadId === row.leadId ? { ...r, followupStatus: next } : r,
              ),
            }
          : p,
      );
      toast.success(`Follow-up set to ${next.replace('_', ' ').toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleReveal = async () => {
    if (!reveal || !reveal.row.assignmentId) return;
    setRevealing(true);
    try {
      const out = await apiSend<Record<string, string | null>>(
        'POST',
        `lead-assignments/${reveal.row.assignmentId}/reveal`,
        { field_keys: [reveal.column.field_key] },
      );
      setReveal({ ...reveal, plain: out[reveal.column.field_key] ?? null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reveal failed');
      setReveal(null);
    } finally {
      setRevealing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = `lead_type=${leadType}${manage && stateFilter !== 'ALL' ? `&state=${stateFilter}` : ''}`;
      const res = await fetch(`/api/proxy/leads/export?${qs}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${leadType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${LEAD_TYPE_LABELS[leadType]} Leads`}
        description={
          manage
            ? `Every ${LEAD_TYPE_LABELS[leadType].toLowerCase()} lead in your scope — assign unsold leads, manually or via auto-match.`
            : `Spreadsheet view of every ${LEAD_TYPE_LABELS[leadType].toLowerCase()} lead in your scope.`
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter rows…"
            className="h-9 w-64 pl-8"
          />
        </div>
        {manage && (
          <Select value={stateFilter} onValueChange={(v) => setStateFilter(v ?? 'ALL')}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All states</SelectItem>
              {STATE_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.toLowerCase().replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Badge variant="secondary">
          {payload ? `${visibleRows.length} / ${payload.total} rows` : '—'}
        </Badge>
        <div className="ml-auto flex gap-2">
          {manage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void matchPool()}
              disabled={matchBusy || loading}
              title="Re-run the auto matcher against every unsold-pool lead"
            >
              {matchBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Match unsold pool
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting || loading}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export CSV
          </Button>
        </div>
      </div>

      {manage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="flex-1" />
          <Button size="sm" onClick={() => setAssignTarget(selectedRows)}>
            <UserPlus className="size-3.5" />
            Assign to order…
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {error ? (
        <Card className="border-destructive bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </Card>
      ) : loading || !payload ? (
        <TableSkeleton rows={10} columns={8} />
      ) : payload.rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {manage
            ? `No ${LEAD_TYPE_LABELS[leadType].toLowerCase()} leads in this view.`
            : `No ${LEAD_TYPE_LABELS[leadType].toLowerCase()} leads delivered yet.`}
        </Card>
      ) : (
        <SheetTable
          payload={payload}
          rows={visibleRows}
          sort={sort}
          toggleSort={toggleSort}
          editableFollowup={editableFollowup}
          canReveal={canReveal}
          manage={manage}
          selected={selected}
          allAssignableSelected={allAssignableSelected}
          someAssignableSelected={someAssignableSelected}
          assignableCount={assignableInView.length}
          busyLeadId={busyLeadId}
          onToggleRow={toggleRow}
          onToggleAll={toggleAllAssignable}
          onAssignRow={(row) => setAssignTarget([row])}
          onRedistributeRow={(row) => void redistributeOne(row)}
          onFollowupChange={handleFollowupChange}
          onReveal={(row, column) => setReveal({ row, column, plain: null })}
        />
      )}

      <Dialog open={reveal !== null} onOpenChange={(open) => !open && setReveal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal {reveal?.column.label}</DialogTitle>
            <DialogDescription>
              Lead <code className="rounded bg-muted px-1">{reveal?.row.publicLeadId}</code>.
              This decrypts the field and writes an audit record. Continue?
            </DialogDescription>
          </DialogHeader>
          {reveal?.plain != null ? (
            <Card className="bg-muted/40 p-4 font-mono text-sm break-all">
              {reveal.plain || '(empty)'}
            </Card>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReveal(null)}>
              {reveal?.plain != null ? 'Close' : 'Cancel'}
            </Button>
            {reveal?.plain == null ? (
              <Button onClick={() => void handleReveal()} disabled={revealing}>
                {revealing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                Reveal
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {manage && (
        <AssignLeadDialog
          open={assignTarget !== null}
          onOpenChange={(o) => !o && setAssignTarget(null)}
          leads={
            assignTarget?.map((r) => ({
              id: r.leadId,
              publicLeadId: r.publicLeadId,
              leadType,
              fullName: rowName(r),
            })) ?? []
          }
          onDone={() => {
            setAssignTarget(null);
            setSelected(new Set());
            void load();
          }}
        />
      )}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface SheetTableProps {
  payload: SheetPayload;
  rows: Row[];
  sort: { key: string; dir: 'asc' | 'desc' } | null;
  toggleSort: (key: string) => void;
  editableFollowup: boolean;
  canReveal: boolean;
  manage: boolean;
  selected: Set<string>;
  allAssignableSelected: boolean;
  someAssignableSelected: boolean;
  assignableCount: number;
  busyLeadId: string | null;
  onToggleRow: (leadId: string) => void;
  onToggleAll: (checked: boolean) => void;
  onAssignRow: (row: Row) => void;
  onRedistributeRow: (row: Row) => void;
  onFollowupChange: (row: Row, next: FollowupStatus) => void;
  onReveal: (row: Row, column: ColumnDef) => void;
}

function SheetTable(props: SheetTableProps) {
  const {
    payload,
    rows,
    sort,
    toggleSort,
    editableFollowup,
    canReveal,
    manage,
    selected,
    allAssignableSelected,
    someAssignableSelected,
    assignableCount,
    busyLeadId,
    onToggleRow,
    onToggleAll,
    onAssignRow,
    onRedistributeRow,
    onFollowupChange,
    onReveal,
  } = props;

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative max-h-[70vh] overflow-auto">
        <table className="w-max border-collapse text-sm">
          <thead className="sticky top-0 z-30 bg-card">
            <tr>
              {payload.columns.map((c, idx) => (
                <th
                  key={c.id}
                  onClick={() => toggleSort(c.field_key)}
                  className={cn(
                    'cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium text-muted-foreground hover:text-foreground',
                    idx === 0 && 'sticky left-0 z-20 bg-card shadow-[1px_0_0_var(--border)]',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {idx === 0 && manage && (
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Checkbox
                          checked={allAssignableSelected}
                          indeterminate={someAssignableSelected}
                          disabled={assignableCount === 0}
                          onCheckedChange={(v) => onToggleAll(v === true)}
                          aria-label="Select all unsold leads in view"
                        />
                      </span>
                    )}
                    {c.label}
                    {sort?.key === c.field_key ? (
                      sort.dir === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-30" />
                    )}
                    {c.sensitive && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">PII</Badge>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const assignable = manage && row.leadState === 'UNSOLD_POOL';
              return (
                <tr
                  key={row.leadId}
                  data-state={selected.has(row.leadId) ? 'selected' : undefined}
                  className={cn(
                    'hover:bg-muted/40',
                    selected.has(row.leadId)
                      ? 'bg-primary/5'
                      : rowIdx % 2 === 0
                        ? 'bg-card'
                        : 'bg-muted/20',
                  )}
                >
                  {payload.columns.map((c, idx) => (
                    <td
                      key={c.id}
                      className={cn(
                        'whitespace-nowrap border-b border-border px-3 py-2',
                        idx === 0 && 'sticky left-0 z-10 shadow-[1px_0_0_var(--border)]',
                        idx === 0 &&
                          (selected.has(row.leadId)
                            ? 'bg-primary/5'
                            : rowIdx % 2 === 0
                              ? 'bg-card'
                              : 'bg-muted/20'),
                      )}
                    >
                      {idx === 0 && manage ? (
                        <LeadIdCell
                          row={row}
                          assignable={assignable}
                          selected={selected.has(row.leadId)}
                          busy={busyLeadId === row.leadId}
                          onToggle={() => onToggleRow(row.leadId)}
                          onAssign={() => onAssignRow(row)}
                          onRedistribute={() => onRedistributeRow(row)}
                        />
                      ) : (
                        <RenderCell
                          column={c}
                          row={row}
                          editableFollowup={editableFollowup}
                          canReveal={canReveal}
                          onFollowupChange={onFollowupChange}
                          onReveal={onReveal}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Cell renderers ────────────────────────────────────────────────────────────

/** First column in manage mode: checkbox + lead id + per-row assign actions. */
function LeadIdCell({
  row,
  assignable,
  selected,
  busy,
  onToggle,
  onAssign,
  onRedistribute,
}: {
  row: Row;
  assignable: boolean;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onAssign: () => void;
  onRedistribute: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Checkbox
        checked={selected}
        disabled={!assignable}
        onCheckedChange={onToggle}
        aria-label={`Select ${row.publicLeadId}`}
      />
      <span className="font-mono text-xs">{row.publicLeadId}</span>
      {assignable && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Lead actions" />}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onAssign}>
              <UserPlus className="size-3.5" />
              Assign to order…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRedistribute}>
              <RefreshCw className="size-3.5" />
              Re-run auto match
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}

interface RenderCellProps {
  column: ColumnDef;
  row: Row;
  editableFollowup: boolean;
  canReveal: boolean;
  onFollowupChange: (row: Row, next: FollowupStatus) => void;
  onReveal: (row: Row, column: ColumnDef) => void;
}

function RenderCell({
  column,
  row,
  editableFollowup,
  canReveal,
  onFollowupChange,
  onReveal,
}: RenderCellProps) {
  // ── Follow-up: editable select for CLIENT (with an assignment), badge else ──
  if (column.field_key === 'followup') {
    if (editableFollowup && row.assignmentId) {
      return (
        <Select
          value={row.followupStatus}
          onValueChange={(v) => onFollowupChange(row, v as FollowupStatus)}
        >
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOLLOWUP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', followupTone(row.followupStatus))}>
        {FOLLOWUP_OPTIONS.find((o) => o.value === row.followupStatus)?.label ?? row.followupStatus}
      </span>
    );
  }

  // ── Status pill for delivery_status ────────────────────────────────────────
  if (column.field_key === 'status') {
    const v = row.values[column.field_key]?.value ?? '—';
    const tone =
      v === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800'
      : v === 'FAILED' ? 'bg-rose-100 text-rose-800'
      : v === 'RETRYING' ? 'bg-amber-100 text-amber-800'
      : 'bg-muted text-muted-foreground';
    return <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', tone)}>{v}</span>;
  }

  const cell = row.values[column.field_key];
  if (!cell) {
    return <span className="text-muted-foreground">—</span>;
  }

  // ── Sensitive cell: masked + reveal button ────────────────────────────────
  if (cell.sensitive) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-mono">{cell.value || '—'}</span>
        {canReveal && cell.value && row.assignmentId ? (
          <button
            type="button"
            onClick={() => onReveal(row, column)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Reveal ${column.label}`}
            title="Reveal value (audit-logged)"
          >
            <EyeOff className="size-3" />
          </button>
        ) : null}
      </span>
    );
  }

  return <span>{formatCellDisplay(cell.value, column.data_type)}</span>;
}
