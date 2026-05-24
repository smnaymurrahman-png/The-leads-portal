'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Phone, ShieldOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { apiGet, apiSend } from '@/lib/proxy-client';

interface SuppressionRow {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * Suppression list — emails + phones that block matching leads at intake.
 * The signed webhook checks these before recording a lead; matching entries
 * get state REJECTED with reason SUPPRESSED, never delivered.
 */
export function SuppressionScreen() {
  const [rows, setRows] = useState<SuppressionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<SuppressionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    try {
      setRows(await apiGet<SuppressionRow[]>(`suppression?${params.toString()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suppression list');
    }
  }, [query]);

  // Debounce the search so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const email = String(fd.get('email') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    const reason = String(fd.get('reason') ?? '').trim();
    if (!email && !phone) {
      throw new Error('Provide an email, a phone, or both.');
    }
    await apiSend('POST', 'suppression', {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(reason ? { reason } : {}),
    });
    await load();
    toast.success('Added to suppression list');
  }

  async function remove(): Promise<void> {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proxy/suppression/${confirmDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Remove failed (${res.status})`);
      toast.success('Removed from suppression list');
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Suppression list"
        description="Opt-outs and do-not-contact entries. Matching leads are auto-rejected at intake with reason SUPPRESSED."
        actions={
          <FormDialog
            triggerLabel="Add entry"
            title="Block a contact from intake"
            description="Provide at least one of email or phone. Matching leads will be rejected with reason SUPPRESSED."
            submitLabel="Add to list"
            onSubmit={onCreate}
          >
            <div className="space-y-3">
              <Field label="Email">
                <Input name="email" type="email" placeholder="user@example.com" />
              </Field>
              <Field label="Phone" hint="E.164 preferred">
                <Input name="phone" placeholder="+15551234567" />
              </Field>
              <Field label="Reason" hint="audit trail">
                <Input name="reason" placeholder="e.g. Consumer opt-out request 2026-05-24" />
              </Field>
            </div>
          </FormDialog>
        }
      />

      <div className="mb-4">
        <Input
          type="search"
          placeholder="Search email, phone, or reason…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <TableSkeleton columns={4} rows={6} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ShieldOff}
              title={query ? 'No matches' : 'Nothing suppressed yet'}
              description={
                query
                  ? 'No suppression entries match your search. Try a different term.'
                  : 'Add an entry to block specific emails or phones from ever entering the lead pool.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.email ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Mail className="size-3.5 text-muted-foreground" />
                          {r.email}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.phone ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Phone className="size-3.5 text-muted-foreground" />
                          {r.phone}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setConfirmDelete(r)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from suppression list?</DialogTitle>
            <DialogDescription>
              Future leads matching{' '}
              <span className="font-medium text-foreground">
                {confirmDelete?.email ?? confirmDelete?.phone}
              </span>{' '}
              will no longer be auto-rejected at intake. Make sure you have a record of why
              the original entry was added.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Remove entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
