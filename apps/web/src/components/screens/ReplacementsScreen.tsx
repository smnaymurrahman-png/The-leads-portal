'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Button, Panel, Select, Table } from '@/components/ui';
import { apiGet, apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

interface ReplacementRow {
  id: string;
  status: string;
  reason: string | null;
  review_note: string | null;
  replacement_code: string | null;
  original_lead: { public_lead_id: string; full_name: string | null } | null;
  replacement_lead: { public_lead_id: string } | null;
  order: { public_order_id: string } | null;
  client: { full_name: string; business_name: string | null } | null;
}

interface DeliveredLead {
  leadId: string;
  publicLeadId: string;
  fullName: string | null;
  deliveryStatus: string;
}

const ACTIVE_STATUSES = new Set(['REQUESTED', 'REVIEW']);

/**
 * Replacement workflow screen. CLIENT requests + sees history with codes;
 * ADMIN/SUPER_ADMIN get a review queue; AGENT views only.
 */
export function ReplacementsScreen({ role }: { role: string }) {
  const isClient = role === 'CLIENT';
  const isReviewer = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const { data: rows, loading, error, reload } = useResource<ReplacementRow>('replacements');

  const [reasons, setReasons] = useState<string[]>([]);
  const [windowHours, setWindowHours] = useState<number | null>(null);
  const [deliveredLeads, setDeliveredLeads] = useState<DeliveredLead[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const policy = await apiGet<{ validReasons: string[]; windowHours: number }>(
          'replacements/policy',
        );
        setReasons(policy.validReasons);
        setWindowHours(policy.windowHours);
      } catch {
        /* policy is optional UI detail */
      }
      if (isClient) {
        try {
          const leads = await apiGet<DeliveredLead[]>('leads/mine');
          setDeliveredLeads(leads.filter((lead) => lead.deliveryStatus === 'DELIVERED'));
        } catch {
          /* ignore */
        }
      }
    })();
  }, [isClient]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setFormError(null);
    try {
      await apiSend('POST', 'replacements', {
        original_lead_id: fd.get('original_lead_id'),
        reason: fd.get('reason'),
      });
      form.reset();
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to submit replacement');
    } finally {
      setSaving(false);
    }
  }

  async function review(id: string, action: 'approve' | 'deny'): Promise<void> {
    let body: unknown = {};
    if (action === 'deny') {
      const note = window.prompt('Reason for denying this replacement:');
      if (!note || !note.trim()) {
        return;
      }
      body = { note: note.trim() };
    }
    setBusyId(id);
    setActionError(null);
    try {
      await apiSend('POST', `replacements/${id}/${action}`, body);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  function rowActions(row: ReplacementRow) {
    if (isReviewer && ACTIVE_STATUSES.has(row.status)) {
      return (
        <div className="flex gap-2">
          <Button type="button" disabled={busyId === row.id} onClick={() => void review(row.id, 'approve')}>
            Approve
          </Button>
          <button
            type="button"
            disabled={busyId === row.id}
            onClick={() => void review(row.id, 'deny')}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      );
    }
    return <span className="text-slate-600">—</span>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Replacements</h1>
        <p className="text-sm text-slate-500">
          {isClient
            ? 'Request a replacement on a delivered lead and track its outcome.'
            : isReviewer
              ? 'Review replacement requests — approve to issue a fresh coded lead.'
              : 'Replacement requests from your clients (view only).'}
        </p>
      </header>

      {isClient && (
        <Panel title="Request a replacement">
          {deliveredLeads.length === 0 ? (
            <p className="text-sm text-slate-500">
              You have no delivered leads available to replace.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Delivered lead" name="original_lead_id" required defaultValue="">
                <option value="" disabled>
                  Select a lead
                </option>
                {deliveredLeads.map((lead) => (
                  <option key={lead.leadId} value={lead.leadId}>
                    {lead.publicLeadId}
                    {lead.fullName ? ` — ${lead.fullName}` : ''}
                  </option>
                ))}
              </Select>
              <Select label="Reason" name="reason" required defaultValue="">
                <option value="" disabled>
                  Select a reason
                </option>
                {reasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit request'}
                </Button>
                {windowHours !== null && (
                  <span className="text-xs text-slate-500">
                    Replacement window: {windowHours}h after delivery
                  </span>
                )}
                {formError && <span className="text-sm text-red-400">{formError}</span>}
              </div>
            </form>
          )}
        </Panel>
      )}

      <Panel title={`${isReviewer ? 'Review queue' : 'History'} (${rows.length})`}>
        {actionError && <p className="mb-3 text-sm text-red-400">{actionError}</p>}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No replacements yet.</p>
        ) : (
          <Table
            headers={['Original lead', 'Client', 'Reason', 'Status', 'Code', 'New lead', 'Actions']}
            rows={rows.map((row) => [
              <span key="orig" className="font-mono text-xs">
                {row.original_lead?.public_lead_id ?? '—'}
              </span>,
              row.client?.business_name ?? row.client?.full_name ?? '—',
              row.reason ?? '—',
              <span key="status">
                {row.status}
                {row.review_note && (
                  <span className="block text-xs text-slate-500">{row.review_note}</span>
                )}
              </span>,
              row.replacement_code ? (
                <code key="code" className="text-xs text-emerald-400">
                  {row.replacement_code}
                </code>
              ) : (
                '—'
              ),
              <span key="new" className="font-mono text-xs">
                {row.replacement_lead?.public_lead_id ?? '—'}
              </span>,
              rowActions(row),
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
