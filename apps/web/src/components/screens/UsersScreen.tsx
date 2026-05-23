'use client';

import { type FormEvent, useState } from 'react';
import { Button, Input, Panel, Select, Table } from '@/components/ui';
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

/** Staff management screen — SUPER_ADMIN / ADMIN. */
export function UsersScreen({ role }: { role: string }) {
  const { data: users, loading, error, reload } = useResource<UserRow>('users');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // An ADMIN cannot mint a SUPER_ADMIN.
  const roleOptions = role === 'SUPER_ADMIN' ? ['SUPER_ADMIN', 'ADMIN', 'AGENT'] : ['ADMIN', 'AGENT'];

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setFormError(null);
    try {
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
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Staff Users</h1>
        <p className="text-sm text-slate-500">Onboard and manage internal staff, including agents.</p>
      </header>

      <Panel title="Onboard a staff member">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Role" name="role" defaultValue="AGENT" required>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Input label="Full name" name="full_name" required />
          <Input label="Work email" name="work_email" type="email" required />
          <Input label="Password" name="password" type="password" minLength={8} required />
          <Input label="Phone" name="phone" />
          <Input label="WhatsApp" name="whatsapp" />
          <Input label="Designation" name="designation" />
          <Input label="Employee ID" name="employee_id" />
          <Input label="LinkedIn URL" name="linkedin_url" />
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create user'}
            </Button>
            {formError && <span className="text-sm text-red-400">{formError}</span>}
          </div>
        </form>
      </Panel>

      <Panel title={`All staff (${users.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">No staff users yet.</p>
        ) : (
          <Table
            headers={['Name', 'Email', 'Role', 'Designation', 'Status']}
            rows={users.map((u) => [
              u.full_name,
              u.work_email,
              u.role,
              u.designation ?? '—',
              u.status,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
