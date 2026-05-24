'use client';

import { Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
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
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { clean, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

interface UserRow {
  id: string;
  role: string;
  full_name: string;
  work_email: string;
  designation: string | null;
  status: string;
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  SUPER_ADMIN: 'default',
  ADMIN: 'secondary',
  AGENT: 'outline',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  PENDING: 'outline',
  SUSPENDED: 'destructive',
  INACTIVE: 'secondary',
};

/** Staff management screen — SUPER_ADMIN / ADMIN. */
export function UsersScreen({ role }: { role: string }) {
  const { data: users, loading, error, reload } = useResource<UserRow>('users');
  // An ADMIN cannot mint a SUPER_ADMIN.
  const roleOptions =
    role === 'SUPER_ADMIN' ? ['SUPER_ADMIN', 'ADMIN', 'AGENT'] : ['ADMIN', 'AGENT'];

  async function onSubmit(form: HTMLFormElement): Promise<void> {
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
            onSubmit={onSubmit}
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={5} rows={6} />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
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
