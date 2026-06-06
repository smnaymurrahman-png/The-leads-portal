'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { apiGet, apiSend } from '@/lib/proxy-client';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'] as const;
type LeadType = (typeof LEAD_TYPES)[number];

const DATA_TYPES = [
  'string',
  'phone',
  'email',
  'date',
  'datetime',
  'money',
  'integer',
  'boolean',
  'enum',
] as const;
const MASK_KINDS = ['ssn', 'account', 'routing', 'dl', 'last4', 'full'] as const;

interface Column {
  id: string;
  lead_type: LeadType;
  position: number;
  field_key: string;
  label: string;
  source: string;
  data_type: string;
  sensitive: boolean;
  mask_kind: string | null;
  default_visible: boolean;
}

interface ColumnFormState {
  field_key: string;
  label: string;
  source: string;
  data_type: string;
  sensitive: boolean;
  mask_kind: string;
  default_visible: boolean;
}

const EMPTY_FORM: ColumnFormState = {
  field_key: '',
  label: '',
  source: 'qualification.',
  data_type: 'string',
  sensitive: false,
  mask_kind: 'full',
  default_visible: true,
};

// ── Screen ───────────────────────────────────────────────────────────────────

export function LeadColumnEditorScreen() {
  const [leadType, setLeadType] = useState<LeadType>('SOLAR');
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [editing, setEditing] = useState<Column | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Column | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setColumns(await apiGet<Column[]>(`lead-type-columns/admin?lead_type=${leadType}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load columns');
    } finally {
      setLoading(false);
    }
  }, [leadType]);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (col: Column, dir: -1 | 1) => {
    const sorted = [...columns].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((c) => c.id === col.id);
    if (idx < 0 || idx + dir < 0 || idx + dir >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    const order = next.map((c) => c.field_key);
    setBusy(col.id);
    try {
      const updated = await apiSend<Column[]>('POST', 'lead-type-columns/reorder', {
        lead_type: leadType,
        order,
      });
      setColumns(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reorder failed');
    } finally {
      setBusy(null);
    }
  };

  const toggleVisible = async (col: Column) => {
    setBusy(col.id);
    try {
      const updated = await apiSend<Column>('PATCH', `lead-type-columns/${col.id}`, {
        default_visible: !col.default_visible,
      });
      setColumns((cs) => cs.map((c) => (c.id === col.id ? updated : c)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await apiSend<void>('POST', `__delete__`, {}).catch(() => null);
      // ConfirmDialog → use fetch directly because apiSend is POST/PATCH/PUT only.
      const res = await fetch(`/api/proxy/lead-type-columns/${deleting.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setColumns((cs) => cs.filter((c) => c.id !== deleting.id));
      setDeleting(null);
      toast.success('Column removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleSave = async (state: ColumnFormState, target: Column | 'new') => {
    const body = {
      label: state.label,
      source: state.source,
      data_type: state.data_type,
      sensitive: state.sensitive,
      mask_kind: state.sensitive ? state.mask_kind : null,
      default_visible: state.default_visible,
    };
    if (target === 'new') {
      const created = await apiSend<Column>('POST', 'lead-type-columns', {
        lead_type: leadType,
        field_key: state.field_key,
        ...body,
      });
      setColumns((cs) => [...cs, created]);
      toast.success(`Column "${state.label}" added`);
    } else {
      const updated = await apiSend<Column>('PATCH', `lead-type-columns/${target.id}`, body);
      setColumns((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
      toast.success('Column updated');
    }
  };

  const sorted = useMemo(() => [...columns].sort((a, b) => a.position - b.position), [columns]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lead Columns"
        description="Add, rename, or reorder the columns shown on each per-vertical Leads sheet. Changes are live."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={leadType} onValueChange={(v) => setLeadType(v as LeadType)}>
          <TabsList>
            {LEAD_TYPES.map((lt) => (
              <TabsTrigger key={lt} value={lt}>
                {lt.charAt(0) + lt.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add column
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive bg-destructive/5 p-4 text-sm text-destructive">{error}</Card>
      ) : loading ? (
        <TableSkeleton rows={12} columns={6} />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">field_key</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Flags</th>
                <th className="w-48 px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((col, idx) => (
                <tr key={col.id} className={cn('border-t border-border', idx % 2 ? 'bg-muted/10' : 'bg-card')}>
                  <td className="px-3 py-2 text-muted-foreground">{col.position}</td>
                  <td className="px-3 py-2 font-medium">{col.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{col.field_key}</td>
                  <td className="px-3 py-2 font-mono text-xs">{col.source}</td>
                  <td className="px-3 py-2 text-xs">
                    <Badge variant="outline">{col.data_type}</Badge>
                  </td>
                  <td className="px-3 py-2 space-x-1">
                    {col.sensitive && (
                      <Badge className="bg-rose-100 text-rose-800">
                        <Lock className="size-3" /> {col.mask_kind ?? 'PII'}
                      </Badge>
                    )}
                    {!col.default_visible && <Badge variant="secondary">hidden</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy === col.id || idx === 0}
                        onClick={() => void move(col, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy === col.id || idx === sorted.length - 1}
                        onClick={() => void move(col, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy === col.id}
                        onClick={() => void toggleVisible(col)}
                        aria-label={col.default_visible ? 'Hide' : 'Show'}
                        title={col.default_visible ? 'Hide from sheet' : 'Show on sheet'}
                      >
                        {col.default_visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(col)}
                        aria-label="Edit"
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(col)}
                        aria-label="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ColumnFormDialog
        open={adding}
        onOpenChange={(open) => !open && setAdding(false)}
        title={`Add column — ${leadType}`}
        initial={EMPTY_FORM}
        editing={false}
        onSave={async (state) => {
          await handleSave(state, 'new');
          setAdding(false);
        }}
      />

      <ColumnFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `Edit column — ${editing.label}` : ''}
        initial={
          editing
            ? {
                field_key: editing.field_key,
                label: editing.label,
                source: editing.source,
                data_type: editing.data_type,
                sensitive: editing.sensitive,
                mask_kind: editing.mask_kind ?? 'full',
                default_visible: editing.default_visible,
              }
            : EMPTY_FORM
        }
        editing
        onSave={async (state) => {
          if (!editing) return;
          await handleSave(state, editing);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.label}"?`}
        description="This column will disappear from the sheet immediately. The stored lead data is unaffected — you can re-add the column later."
        confirmLabel="Delete column"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ── Form dialog ──────────────────────────────────────────────────────────────

interface ColumnFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: ColumnFormState;
  editing: boolean;
  onSave: (state: ColumnFormState) => Promise<void>;
}

function ColumnFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  editing,
  onSave,
}: ColumnFormDialogProps) {
  const [state, setState] = useState<ColumnFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setState(initial);
      setError(null);
    }
  }, [open, initial]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(state);
      onOpenChange(false); // close on success — otherwise the dialog just sits there
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            Source values:&nbsp;
            <code className="text-xs">lead.&lt;col&gt;</code>,&nbsp;
            <code className="text-xs">qualification.&lt;key&gt;</code>,&nbsp;
            <code className="text-xs">system.&lt;public_lead_id|captured_at|lead_state|landing_page&gt;</code>,&nbsp;
            <code className="text-xs">assignment.&lt;delivery_status|delivered_at|followup_status&gt;</code>,&nbsp;
            <code className="text-xs">order.public_order_id</code>,&nbsp;
            <code className="text-xs">replacement.status</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Label" full>
            <Input
              value={state.label}
              onChange={(e) => setState((s) => ({ ...s, label: e.target.value }))}
              placeholder="Loan Amount"
            />
          </Field>
          <Field label="field_key" full>
            <Input
              value={state.field_key}
              onChange={(e) => setState((s) => ({ ...s, field_key: e.target.value.toLowerCase() }))}
              placeholder="loan_amount"
              disabled={editing}
            />
          </Field>
          <Field label="Source" full>
            <Input
              value={state.source}
              onChange={(e) => setState((s) => ({ ...s, source: e.target.value }))}
              placeholder="qualification.loan_amount"
              className="font-mono"
            />
          </Field>
          <Field label="Data type">
            <Select value={state.data_type} onValueChange={(v) => setState((s) => ({ ...s, data_type: v ?? 'string' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Visible by default">
            <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <Checkbox
                checked={state.default_visible}
                onCheckedChange={(v) => setState((s) => ({ ...s, default_visible: v === true }))}
              />
              Show on sheet
            </label>
          </Field>
          <Field label="Sensitive (PII)">
            <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <Checkbox
                checked={state.sensitive}
                onCheckedChange={(v) => setState((s) => ({ ...s, sensitive: v === true }))}
              />
              Encrypt + mask
            </label>
          </Field>
          {state.sensitive && (
            <Field label="Mask">
              <Select value={state.mask_kind} onValueChange={(v) => setState((s) => ({ ...s, mask_kind: v ?? 'full' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MASK_KINDS.map((mk) => (
                    <SelectItem key={mk} value={mk}>{mk}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter showCloseButton>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add column'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
