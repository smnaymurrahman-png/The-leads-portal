'use client';

import { useMemo, useState } from 'react';
import { Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditDialog } from '@/components/EditDialog';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { RowActions } from '@/components/RowActions';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { clean, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

type AccountStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE';

interface UserRow {
  id: string;
  role: string;
  full_name: string;
  work_email: string;
  designation: string | null;
  phone: string | null;
  whatsapp: string | null;
  employee_id: string | null;
  linkedin_url: string | null;
  status: AccountStatus;
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  SUPER_ADMIN: 'default',
  ADMIN: 'secondary',
  AGENT: 'outline',
};

const STATUS_VARIANT: Record<AccountStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  PENDING: 'outline',
  SUSPENDED: 'destructive',
  INACTIVE: 'secondary',
};

/** Staff management screen — SUPER_ADMIN / ADMIN. */
export function UsersScreen({ role }: { role: string }) {
  const { data: users, loading, error, reload } = useResource<UserRow>('users');
  const roleOptions =
    role === 'SUPER_ADMIN' ? ['SUPER_ADMIN', 'ADMIN', 'AGENT'] : ['ADMIN', 'AGENT'];

  // Selection + mutation state — kept inline so the screen is self-contained.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deletingOne, setDeletingOne] = useState<UserRow | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<'delete' | 'activate' | 'deactivate' | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const selectedRows = useMemo(
    () => users.filter((u) => selected.has(u.id)),
    [users, selected],
  );
  const allChecked = users.length > 0 && selected.size === users.length;
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll(checked: boolean): void {
    setSelected(checked ? new Set(users.map((u) => u.id)) : new Set());
  }

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    await apiSend(
      'POST',
      'users',
      clean({
        role: str(fd.get('role')),
        full_name: str(fd.get('full_name')),
        work_email: str(fd.get('work_email')),
        password: str(fd.get('password')),
        phone: opt(fd.get('phone')),
        whatsapp: opt(fd.get('whatsapp')),
        designation: opt(fd.get('designation')),
        employee_id: opt(fd.get('employee_id')),
        linkedin_url: opt(fd.get('linkedin_url')),
      }),
    );
    await reload();
    toast.success('Staff user created');
  }

  async function onEditSubmit(form: HTMLFormElement): Promise<void> {
    if (!editing) return;
    const fd = new FormData(form);
    await apiSend(
      'PATCH',
      `users/${editing.id}`,
      clean({
        full_name: opt(fd.get('full_name')),
        phone: opt(fd.get('phone')),
        whatsapp: opt(fd.get('whatsapp')),
        designation: opt(fd.get('designation')),
        employee_id: opt(fd.get('employee_id')),
        linkedin_url: opt(fd.get('linkedin_url')),
      }),
    );
    await reload();
    toast.success(`${editing.full_name} updated`);
  }

  async function setStatus(ids: string[], status: AccountStatus, verb: string): Promise<void> {
    setPending(true);
    try {
      await Promise.all(ids.map((id) => apiSend('PATCH', `users/${id}`, { status })));
      await reload();
      setSelected(new Set());
      toast.success(`${ids.length === 1 ? '1 user' : `${ids.length} users`} ${verb}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  async function deleteIds(ids: string[]): Promise<void> {
    setPending(true);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/proxy/users/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Delete failed (${res.status})`);
        }
      }),
    );
    setPending(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    await reload();
    setSelected(new Set());
    if (fail === 0) toast.success(`${ok} deleted`);
    else if (ok === 0) {
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      toast.error(first.reason instanceof Error ? first.reason.message : 'Delete failed');
    } else toast.warning(`${ok} deleted, ${fail} failed (likely referenced elsewhere)`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Staff users"
        description="Onboard and manage internal staff, including agents."
        actions={
          <FormDialog
            triggerLabel="New user"
            title="Onboard a staff member"
            description="They'll receive their login credentials and can sign in immediately."
            submitLabel="Create user"
            onSubmit={onCreate}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Role">
                <Select name="role" defaultValue="AGENT">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Full name">
                <Input name="full_name" required />
              </Field>
              <Field label="Work email">
                <Input name="work_email" type="email" required />
              </Field>
              <Field label="Password" hint="min 8 chars">
                <Input name="password" type="password" minLength={8} required />
              </Field>
              <Field label="Phone">
                <Input name="phone" />
              </Field>
              <Field label="WhatsApp">
                <Input name="whatsapp" />
              </Field>
              <Field label="Designation">
                <Input name="designation" />
              </Field>
              <Field label="Employee ID">
                <Input name="employee_id" />
              </Field>
              <Field label="LinkedIn" className="sm:col-span-2">
                <Input name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" />
              </Field>
            </div>
          </FormDialog>
        }
      />

      <BulkActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onActivate={() => setBulkConfirm('activate')}
        onDeactivate={() => setBulkConfirm('deactivate')}
        onDelete={() => setBulkConfirm('delete')}
        pending={pending}
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No staff users yet"
              description="Use the New user button to onboard your first staff member."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked}
                      onCheckedChange={(c) => toggleAll(c === true)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-state={selected.has(u.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={() => toggleOne(u.id)}
                        aria-label={`Select ${u.full_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${u.work_email}`}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="size-3.5" />
                        {u.work_email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANT[u.role] ?? 'outline'}>
                        {u.role.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.designation ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[u.status] ?? 'outline'}>
                        {u.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        status={u.status}
                        onEdit={() => setEditing(u)}
                        onActivate={() => void setStatus([u.id], 'ACTIVE', 'activated')}
                        onDeactivate={() => void setStatus([u.id], 'SUSPENDED', 'deactivated')}
                        onDelete={() => setDeletingOne(u)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Edit ${editing.full_name}`}
          description="Email and role can't be changed here — re-create the account if those need to move."
          onSubmit={onEditSubmit}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input name="full_name" defaultValue={editing.full_name} required />
            </Field>
            <Field label="Designation">
              <Input name="designation" defaultValue={editing.designation ?? ''} />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={editing.phone ?? ''} />
            </Field>
            <Field label="WhatsApp">
              <Input name="whatsapp" defaultValue={editing.whatsapp ?? ''} />
            </Field>
            <Field label="Employee ID">
              <Input name="employee_id" defaultValue={editing.employee_id ?? ''} />
            </Field>
            <Field label="LinkedIn">
              <Input
                name="linkedin_url"
                type="url"
                defaultValue={editing.linkedin_url ?? ''}
              />
            </Field>
          </div>
        </EditDialog>
      )}

      <ConfirmDialog
        open={deletingOne !== null}
        onOpenChange={(o) => !o && setDeletingOne(null)}
        title={`Delete ${deletingOne?.full_name}?`}
        description="This permanently removes the staff account. Use Deactivate instead if you want a reversible action."
        confirmLabel="Delete user"
        destructive
        onConfirm={async () => {
          if (deletingOne) await deleteIds([deletingOne.id]);
        }}
      />

      <ConfirmDialog
        open={bulkConfirm !== null}
        onOpenChange={(o) => !o && setBulkConfirm(null)}
        title={
          bulkConfirm === 'delete'
            ? `Delete ${selected.size} users?`
            : bulkConfirm === 'activate'
              ? `Activate ${selected.size} users?`
              : `Deactivate ${selected.size} users?`
        }
        description={
          bulkConfirm === 'delete'
            ? 'Accounts referenced by orders or clients can\'t be hard-deleted — they will be skipped.'
            : `Each selected account's status will be set to ${bulkConfirm === 'activate' ? 'ACTIVE' : 'SUSPENDED'}.`
        }
        confirmLabel={
          bulkConfirm === 'delete'
            ? 'Delete'
            : bulkConfirm === 'activate'
              ? 'Activate'
              : 'Deactivate'
        }
        destructive={bulkConfirm === 'delete'}
        onConfirm={async () => {
          if (bulkConfirm === 'delete') await deleteIds(selectedRows.map((u) => u.id));
          else if (bulkConfirm === 'activate')
            await setStatus(selectedRows.map((u) => u.id), 'ACTIVE', 'activated');
          else await setStatus(selectedRows.map((u) => u.id), 'SUSPENDED', 'deactivated');
        }}
      />
    </div>
  );
}
