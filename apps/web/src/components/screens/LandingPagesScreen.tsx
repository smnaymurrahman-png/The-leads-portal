'use client';

import { type FormEvent, useState } from 'react';
import { Button, Input, Panel, Select, Table } from '@/components/ui';
import { clean, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const STATUSES = ['WORKING', 'PUBLISHED'];

interface LandingRow {
  id: string;
  lead_type: string;
  name: string;
  web_link: string | null;
  status: string;
  intake_secret: string;
}

/** Landing pages. All staff can view; ADMIN/SUPER_ADMIN can create. */
export function LandingPagesScreen({ role }: { role: string }) {
  const canManage = role !== 'AGENT';
  const { data: pages, loading, error, reload } = useResource<LandingRow>('landing-pages');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setFormError(null);

    // field_map is an optional JSON object typed into a textarea.
    let field_map: Record<string, unknown> | undefined;
    const rawMap = str(fd.get('field_map'));
    if (rawMap) {
      try {
        field_map = JSON.parse(rawMap) as Record<string, unknown>;
      } catch {
        setFormError('Field map must be valid JSON.');
        setSaving(false);
        return;
      }
    }

    try {
      await apiSend('POST', 'landing-pages', {
        ...clean({
          lead_type: str(fd.get('lead_type')),
          name: str(fd.get('name')),
          web_link: opt(fd.get('web_link')),
          status: str(fd.get('status')),
          intake_secret: opt(fd.get('intake_secret')),
        }),
        ...(field_map ? { field_map } : {}),
      });
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create landing page');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Landing Pages</h1>
        <p className="text-sm text-slate-500">Lead-capture pages and their intake secrets.</p>
      </header>

      {canManage && (
        <Panel title="Create a landing page">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Lead type" name="lead_type" defaultValue="SOLAR" required>
              {LEAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input label="Name" name="name" required />
            <Select label="Status" name="status" defaultValue="WORKING">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input label="Web link" name="web_link" />
            <Input
              label="Intake secret (optional — auto-generated)"
              name="intake_secret"
              minLength={16}
            />
            <Input label='Field map JSON (e.g. {"email":"email_addr"})' name="field_map" />
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create landing page'}
              </Button>
              {formError && <span className="text-sm text-red-400">{formError}</span>}
            </div>
          </form>
        </Panel>
      )}

      <Panel title={`Landing pages (${pages.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-slate-500">No landing pages yet.</p>
        ) : (
          <Table
            headers={['Name', 'Type', 'Status', 'Web link', 'Intake secret']}
            rows={pages.map((p) => [
              p.name,
              p.lead_type,
              p.status,
              p.web_link ?? '—',
              <code key={p.id} className="text-xs text-slate-500">
                {p.intake_secret.slice(0, 12)}…
              </code>,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
