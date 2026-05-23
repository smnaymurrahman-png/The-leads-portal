'use client';

import { type FormEvent, useState } from 'react';
import { Button, Input, Panel, Select, Table } from '@/components/ui';
import { clean, num, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const ADS_TYPES = ['FACEBOOK', 'GOOGLE', 'TIKTOK', 'YOUTUBE', 'OTHER'];

interface CampaignRow {
  id: string;
  name: string;
  ads_type: string;
  budget: string | null;
  day_count: number | null;
  results: unknown;
}

/** Campaigns. All staff can view; ADMIN/SUPER_ADMIN can create. */
export function CampaignsScreen({ role }: { role: string }) {
  const canManage = role !== 'AGENT';
  const { data: campaigns, loading, error, reload } = useResource<CampaignRow>('campaigns');
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
        'campaigns',
        clean({
          name: str(fd.get('name')),
          ads_type: str(fd.get('ads_type')),
          details: opt(fd.get('details')),
          production_link: opt(fd.get('production_link')),
          budget: num(fd.get('budget')),
          day_count: num(fd.get('day_count')),
        }),
      );
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Campaigns</h1>
        <p className="text-sm text-slate-500">Ad campaigns feeding the lead pipeline.</p>
      </header>

      {canManage && (
        <Panel title="Create a campaign">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Name" name="name" required />
            <Select label="Ads type" name="ads_type" defaultValue="FACEBOOK" required>
              {ADS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input label="Production link" name="production_link" />
            <Input label="Budget (USD)" name="budget" type="number" min={0} step="0.01" />
            <Input label="Day count" name="day_count" type="number" min={0} />
            <Input label="Details" name="details" />
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create campaign'}
              </Button>
              {formError && <span className="text-sm text-red-400">{formError}</span>}
            </div>
          </form>
        </Panel>
      )}

      <Panel title={`Campaigns (${campaigns.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">No campaigns yet.</p>
        ) : (
          <Table
            headers={['Name', 'Ads type', 'Budget', 'Days', 'Results']}
            rows={campaigns.map((c) => [
              c.name,
              c.ads_type,
              c.budget ? `$${c.budget}` : '—',
              c.day_count ?? '—',
              c.results ? (
                <code className="text-xs text-slate-400">{JSON.stringify(c.results)}</code>
              ) : (
                '—'
              ),
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
