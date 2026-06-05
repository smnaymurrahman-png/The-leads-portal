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
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  assignmentId: string;
  leadId: string;
  publicLeadId: string;
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

const SYSTEM_FIELD_KEYS = new Set([
  'lead_id',
  'status',
  'captured',
  'delivered',
  'order',
  'source',
  'replacement',
  'followup',
]);

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

// ── Screen ────────────────────────────────────────────────────────────────────

export interface LeadsSheetScreenProps {
  leadType: LeadType;
  /** Whether the Follow-up cell is editable (CLIENT only). */
  editableFollowup?: boolean;
  /** Whether the caller may decrypt sensitive cells. Everyone CAN today; we may
   * restrict to certain roles later. Hide the reveal button when false. */
  canReveal?: boolean;
}

export function LeadsSheetScreen({
  leadType,
  editableFollowup = false,
  canReveal = true,
}: LeadsSheetScreenProps) {
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState('');
  const [sort, setSort]         = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reveal, setReveal]     = useState<{ row: Row; column: ColumnDef; plain: string | null } | null>(null);
  const [revealing, setRevealing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SheetPayload>(
        `leads/sheet?lead_type=${leadType}&limit=500`,
      );
      setPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [leadType]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-sort + filter happen client-side over the loaded page.
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

  const toggleSort = (key: string) =>
    setSort((s) =>
      !s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null,
    );

  const handleFollowupChange = async (row: Row, next: FollowupStatus) => {
    try {
      await apiSend('PATCH', `lead-assignments/${row.assignmentId}/followup`, { status: next });
      setPayload((p) =>
        p
          ? {
              ...p,
              rows: p.rows.map((r) =>
                r.assignmentId === row.assignmentId ? { ...r, followupStatus: next } : r,
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
    if (!reveal) return;
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
      const res = await fetch(`/api/proxy/leads/export?lead_type=${leadType}`);
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
        description={`Spreadsheet view of every ${LEAD_TYPE_LABELS[leadType].toLowerCase()} lead in your scope.`}
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
        <Badge variant="secondary">
          {payload ? `${visibleRows.length} / ${payload.total} rows` : '—'}
        </Badge>
        <div className="ml-auto flex gap-2">
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

      {error ? (
        <Card className="border-destructive bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </Card>
      ) : loading || !payload ? (
        <TableSkeleton rows={10} columns={8} />
      ) : payload.rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No {LEAD_TYPE_LABELS[leadType].toLowerCase()} leads delivered yet.
        </Card>
      ) : (
        <SheetTable
          payload={payload}
          rows={visibleRows}
          sort={sort}
          toggleSort={toggleSort}
          editableFollowup={editableFollowup}
          canReveal={canReveal}
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
  onFollowupChange: (row: Row, next: FollowupStatus) => void;
  onReveal: (row: Row, column: ColumnDef) => void;
}

function SheetTable({
  payload,
  rows,
  sort,
  toggleSort,
  editableFollowup,
  canReveal,
  onFollowupChange,
  onReveal,
}: SheetTableProps) {
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
                  <span className="inline-flex items-center gap-1">
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
            {rows.map((row, rowIdx) => (
              <tr
                key={row.assignmentId}
                className={cn('hover:bg-muted/40', rowIdx % 2 === 0 ? 'bg-card' : 'bg-muted/20')}
              >
                {payload.columns.map((c, idx) => (
                  <td
                    key={c.id}
                    className={cn(
                      'whitespace-nowrap border-b border-border px-3 py-2',
                      idx === 0 && 'sticky left-0 z-10 font-mono text-xs shadow-[1px_0_0_var(--border)]',
                      idx === 0 && (rowIdx % 2 === 0 ? 'bg-card' : 'bg-muted/20'),
                    )}
                  >
                    <RenderCell
                      column={c}
                      row={row}
                      editableFollowup={editableFollowup}
                      canReveal={canReveal}
                      onFollowupChange={onFollowupChange}
                      onReveal={onReveal}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Cell renderers ────────────────────────────────────────────────────────────

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
  // ── Follow-up: editable select for CLIENT, read-only badge for others ──────
  if (column.field_key === 'followup') {
    if (editableFollowup) {
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
        {canReveal && cell.value ? (
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

// Keep referenced — tells TS the SYSTEM_FIELD_KEYS constant is "used".
void SYSTEM_FIELD_KEYS;
