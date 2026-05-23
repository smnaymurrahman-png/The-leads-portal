'use client';

import { type FormEvent, useState } from 'react';
import { Button, Input, Panel, Select, Table } from '@/components/ui';
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

/** Client (buyer) management. AGENT sees only their own; staff see all. */
export function ClientsScreen({ role }: { role: string }) {
  const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: clients, loading, error, reload } = useResource<ClientRow>('clients');
  // Staff pick the owning agent; an AGENT owns the clients they create.
  const agents = useResource<AgentOption>(isStaff ? 'users?role=AGENT' : null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setFormError(null);
    try {
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
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create client');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Clients</h1>
        <p className="text-sm text-slate-500">
          {isStaff
            ? 'Every client across all agents.'
            : 'The clients you own. Other agents’ clients are not visible.'}
        </p>
      </header>

      <Panel title="Add a client">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isStaff && (
            <Select label="Owning agent" name="agent_id" required defaultValue="">
              <option value="" disabled>
                {agents.loading ? 'Loading agents…' : 'Select an agent'}
              </option>
              {agents.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </Select>
          )}
          <Input label="Full name" name="full_name" required />
          <Input label="Email" name="email" type="email" required />
          <Input label="Password" name="password" type="password" minLength={8} required />
          <Input label="Phone" name="phone" />
          <Input label="WhatsApp" name="whatsapp" />
          <Input label="Business name" name="business_name" />
          <Input label="Address" name="address" />
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create client'}
            </Button>
            {formError && <span className="text-sm text-red-400">{formError}</span>}
          </div>
        </form>
      </Panel>

      <Panel title={`Clients (${clients.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">No clients yet.</p>
        ) : (
          <Table
            headers={['Name', 'Business', 'Email', 'Phone', 'Status']}
            rows={clients.map((c) => [
              c.full_name,
              c.business_name ?? '—',
              c.email,
              c.phone ?? '—',
              c.status,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
