'use client';

import { Panel, Table } from '@/components/ui';
import { useResource } from '@/lib/use-resource';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  actor: { full_name: string; role: string } | null;
}

/** SUPER_ADMIN audit viewer — every sensitive action, newest first. */
export function AuditScreen() {
  const { data, loading, error } = useResource<AuditRow>('audit');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Audit Log</h1>
        <p className="text-sm text-slate-500">
          Order decisions, manual assignments, refunds, replacement reviews and policy changes.
        </p>
      </header>

      <Panel title={`Entries (${data.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">No audited actions yet.</p>
        ) : (
          <Table
            headers={['When', 'Actor', 'Action', 'Entity', 'Entity ID']}
            rows={data.map((row) => [
              new Date(row.created_at).toLocaleString(),
              row.actor ? `${row.actor.full_name} (${row.actor.role})` : 'system',
              <span key="action" className="font-medium text-slate-200">
                {row.action}
              </span>,
              row.entity,
              <code key="eid" className="text-xs text-slate-500">
                {row.entity_id ?? '—'}
              </code>,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
