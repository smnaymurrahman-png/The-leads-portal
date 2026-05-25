'use client';

import { Building2 } from 'lucide-react';
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
import { useEntityActions } from '@/hooks/use-entity-actions';
import { clean, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

type AccountStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE';

interface ClientRow {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  status: AccountStatus;
}

interface AgentOption {
  id: string;
  full_name: string;
}

const STATUS_VARIANT: Record<AccountStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  PENDING: 'outline',
  SUSPENDED: 'destructive',
  INACTIVE: 'secondary',
};

/** Client (buyer) management. AGENT sees only their own; staff see all. */
export function ClientsScreen({ role }: { role: string }) {
  const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: clients, loading, error, reload } = useResource<ClientRow>('clients');
  const agents = useResource<AgentOption>(isStaff ? 'users?role=AGENT' : null);
  const a = useEntityActions<ClientRow>('clients', reload);

  const allChecked = clients.length > 0 && a.selected.size === clients.length;
  const someChecked = a.selected.size > 0 && !allChecked;

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    await apiSend(
      'POST',
      'clients',
      clean({
        full_name: str(fd.get('full_name')),
        email: str(fd.get('email')),
        password: str(fd.get('password')),
        phone: opt(fd.get('phone')),
        whatsapp: opt(fd.get('whatsapp')),
        business_name: opt(fd.get('business_name')),
        address: opt(fd.get('address')),
        agent_id: isStaff ? opt(fd.get('agent_id')) : undefined,
      }),
    );
    await reload();
    toast.success('Client created');
  }

  async function onEditSubmit(form: HTMLFormElement): Promise<void> {
    if (!a.editing) return;
    const fd = new FormData(form);
    await apiSend(
      'PATCH',
      `clients/${a.editing.id}`,
      clean({
        full_name: opt(fd.get('full_name')),
        business_name: opt(fd.get('business_name')),
        phone: opt(fd.get('phone')),
        whatsapp: opt(fd.get('whatsapp')),
        address: opt(fd.get('address')),
      }),
    );
    await reload();
    toast.success(`${a.editing.full_name} updated`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Clients"
        description={
          isStaff
            ? 'Every client account across the network.'
            : "The clients you own. Other agents' clients are not visible."
        }
        actions={
          <FormDialog
            triggerLabel="New client"
            title="Create a client account"
            description="Clients can log in and place orders immediately."
            submitLabel="Create client"
            onSubmit={onCreate}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {isStaff && (
                <Field label="Owning agent" className="sm:col-span-2">
                  <Select name="agent_id">
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={agents.loading ? 'Loading agents…' : 'Select an agent'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.data.map((ag) => (
                        <SelectItem key={ag.id} value={ag.id}>
                          {ag.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Full name">
                <Input name="full_name" required />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required />
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
              <Field label="Business name">
                <Input name="business_name" />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input name="address" />
              </Field>
            </div>
          </FormDialog>
        }
      />

      <BulkActionsBar
        count={a.selected.size}
        onClear={a.clear}
        onActivate={() => a.setBulkConfirm('activate')}
        onDeactivate={() => a.setBulkConfirm('deactivate')}
        onDelete={() => a.setBulkConfirm('delete')}
        pending={a.pending}
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No clients yet"
              description={
                isStaff
                  ? 'Use New client to create the first buyer account.'
                  : "You don't own any clients yet. Create one to start placing orders."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked}
                      onCheckedChange={(c) => a.toggleAll(clients, c === true)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} data-state={a.isSelected(c.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={a.isSelected(c.id)}
                        onCheckedChange={() => a.toggleOne(c.id)}
                        aria-label={`Select ${c.full_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.business_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${c.email}`}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {c.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.phone ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'outline'}>
                        {c.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        status={c.status}
                        onEdit={() => a.setEditing(c)}
                        onActivate={() => void a.setStatus([c.id], 'ACTIVE', 'activated')}
                        onDeactivate={() => void a.setStatus([c.id], 'SUSPENDED', 'deactivated')}
                        onDelete={() => a.setDeletingOne(c)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {a.editing && (
        <EditDialog
          open
          onOpenChange={(o) => !o && a.setEditing(null)}
          title={`Edit ${a.editing.full_name}`}
          description="Email and password can't be changed here. Use New client if you need to fully reset an account."
          onSubmit={onEditSubmit}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input name="full_name" defaultValue={a.editing.full_name} required />
            </Field>
            <Field label="Business name">
              <Input name="business_name" defaultValue={a.editing.business_name ?? ''} />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={a.editing.phone ?? ''} />
            </Field>
            <Field label="WhatsApp">
              <Input name="whatsapp" defaultValue={a.editing.whatsapp ?? ''} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input name="address" defaultValue={a.editing.address ?? ''} />
            </Field>
          </div>
        </EditDialog>
      )}

      <ConfirmDialog
        open={a.deletingOne !== null}
        onOpenChange={(o) => !o && a.setDeletingOne(null)}
        title={`Delete ${a.deletingOne?.full_name}?`}
        description="This permanently removes the client account. Deactivate instead if you want a reversible action."
        confirmLabel="Delete client"
        destructive
        onConfirm={async () => {
          if (a.deletingOne) await a.deleteIds([a.deletingOne.id]);
        }}
      />

      <ConfirmDialog
        open={a.bulkConfirm !== null}
        onOpenChange={(o) => !o && a.setBulkConfirm(null)}
        title={
          a.bulkConfirm === 'delete'
            ? `Delete ${a.selected.size} clients?`
            : a.bulkConfirm === 'activate'
              ? `Activate ${a.selected.size} clients?`
              : `Deactivate ${a.selected.size} clients?`
        }
        description={
          a.bulkConfirm === 'delete'
            ? "Clients with orders or leads can't be hard-deleted — they will be skipped."
            : `Each selected client's status will change to ${a.bulkConfirm === 'activate' ? 'ACTIVE' : 'SUSPENDED'}.`
        }
        confirmLabel={
          a.bulkConfirm === 'delete'
            ? 'Delete'
            : a.bulkConfirm === 'activate'
              ? 'Activate'
              : 'Deactivate'
        }
        destructive={a.bulkConfirm === 'delete'}
        onConfirm={async () => {
          if (a.bulkConfirm === 'delete') await a.deleteIds(a.selectedIds);
          else if (a.bulkConfirm === 'activate')
            await a.setStatus(a.selectedIds, 'ACTIVE', 'activated');
          else await a.setStatus(a.selectedIds, 'SUSPENDED', 'deactivated');
        }}
      />
    </div>
  );
}
