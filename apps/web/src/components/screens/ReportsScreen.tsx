'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Panel, Table } from '@/components/ui';
import { apiGet } from '@/lib/proxy-client';

interface Dashboard {
  totals: { users: number; clients: number; orders: number; leads: number };
  today: { orders: number; sales: number };
  revenue: {
    grossSales: number;
    refunds: number;
    netSales: number;
    expenses: number;
    commissions: number;
    profit: number;
  };
}

interface Kpis {
  totalLeads: number;
  deliveredLeads: number;
  costPerLead: number;
  validLeadRate: number;
  duplicateRate: number;
  replacementRate: number;
  acceptanceRate: number;
  buyerRetentionRate: number;
  unsoldPoolSize: number;
  captureToDeliveryMinutes: number;
}

interface Commission {
  id: string;
  amount: string;
  rate: string;
  agent: { full_name: string } | null;
  order: { public_order_id: string } | null;
}

interface LedgerRow {
  id: string;
  publicLeadId: string;
  leadType: string;
  state: string;
  rejectReason: string | null;
  assignments: number;
}

const money = (value: number): string =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

/** Revenue + KPI reporting dashboard (ADMIN / SUPER_ADMIN). */
export function ReportsScreen() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [dash, kpi, comm, led] = await Promise.all([
          apiGet<Dashboard>('reports/dashboard'),
          apiGet<Kpis>('reports/kpis'),
          apiGet<Commission[]>('revenue/commissions'),
          apiGet<LedgerRow[]>('reports/leads-ledger?limit=25'),
        ]);
        setDashboard(dash);
        setKpis(kpi);
        setCommissions(comm);
        setLedger(led);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading reports…</p>;
  }
  if (error || !dashboard || !kpis) {
    return <p className="text-sm text-red-400">{error ?? 'Reports unavailable'}</p>;
  }

  const { revenue, totals, today } = dashboard;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Reports</h1>
        <p className="text-sm text-slate-500">Revenue, profit/loss and operational KPIs.</p>
      </header>

      <Panel title="Revenue">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Gross sales" value={money(revenue.grossSales)} />
          <Metric label="Refunds" value={money(revenue.refunds)} />
          <Metric label="Net sales" value={money(revenue.netSales)} />
          <Metric label="Expenses" value={money(revenue.expenses)} />
          <Metric label="Commissions" value={money(revenue.commissions)} />
          <Metric
            label="Profit / loss"
            value={
              <span className={revenue.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {money(revenue.profit)}
              </span>
            }
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Today">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Orders today" value={today.orders} />
            <Metric label="Sales today" value={money(today.sales)} />
          </div>
        </Panel>
        <Panel title="Totals">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Clients" value={totals.clients} />
            <Metric label="Orders" value={totals.orders} />
            <Metric label="Leads" value={totals.leads} />
            <Metric label="Staff" value={totals.users} />
          </div>
        </Panel>
      </div>

      <Panel title="KPIs">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Cost per lead" value={money(kpis.costPerLead)} />
          <Metric label="Valid-lead rate" value={percent(kpis.validLeadRate)} />
          <Metric label="Duplicate rate" value={percent(kpis.duplicateRate)} />
          <Metric label="Replacement rate" value={percent(kpis.replacementRate)} />
          <Metric label="Acceptance rate" value={percent(kpis.acceptanceRate)} />
          <Metric label="Buyer retention" value={percent(kpis.buyerRetentionRate)} />
          <Metric label="Unsold pool" value={kpis.unsoldPoolSize} />
          <Metric label="Capture→delivery" value={`${kpis.captureToDeliveryMinutes} min`} />
        </div>
      </Panel>

      <Panel title={`Agent commissions (${commissions.length})`}>
        {commissions.length === 0 ? (
          <p className="text-sm text-slate-500">No commissions booked yet.</p>
        ) : (
          <Table
            headers={['Agent', 'Order', 'Rate', 'Amount']}
            rows={commissions.map((c) => [
              c.agent?.full_name ?? '—',
              <span key="ord" className="font-mono text-xs">
                {c.order?.public_order_id ?? '—'}
              </span>,
              percent(Number(c.rate)),
              money(Number(c.amount)),
            ])}
          />
        )}
      </Panel>

      <Panel title={`Leads ledger (latest ${ledger.length})`}>
        {ledger.length === 0 ? (
          <p className="text-sm text-slate-500">No leads captured yet.</p>
        ) : (
          <Table
            headers={['Lead', 'Type', 'State', 'Reject reason', 'Assignments']}
            rows={ledger.map((row) => [
              <span key="id" className="font-mono text-xs">
                {row.publicLeadId}
              </span>,
              row.leadType,
              row.state,
              row.rejectReason ?? '—',
              row.assignments,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
