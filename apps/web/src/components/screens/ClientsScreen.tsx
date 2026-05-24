'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { clean, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

interface ClientRow {
  id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  status: string;
}

interface AgentOption {
  id: string;
  full_name: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
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

  async function onSubmit(form: HTMLFormElement): Promise<void> {
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
            onSubmit={onSubmit}
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
                      {agents.data.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.full_name}
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-12 text-sm text-muted-foreground">Loading clients…</p>
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : clients.length === 0 ? (
            <p className="px-6 py-12 text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
