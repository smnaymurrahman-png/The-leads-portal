'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Panel, Table } from '@/components/ui';
import { apiGet } from '@/lib/proxy-client';

interface LeadItem {
  assignmentId: string;
  publicLeadId: string;
  leadType: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  createdAt: string;
  deliveryStatus: string;
}

type ConnectionStatus = 'connecting' | 'live' | 'offline';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
/** Socket.IO attaches to the API origin, not the `/api` REST prefix. */
const SOCKET_ORIGIN = API_URL.replace(/\/api\/?$/, '');

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function LiveLeadsScreen() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [tab, setTab] = useState<'today' | 'all'>('today');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function start(): Promise<void> {
      // 1. Load the existing leads.
      try {
        const initial = await apiGet<LeadItem[]>('leads/mine');
        if (!cancelled) setLeads(initial);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leads');
      }

      // 2. Fetch a socket token (the JWT, copied out of the httpOnly cookie).
      let token: string;
      try {
        const res = await fetch('/api/auth/socket-token');
        if (!res.ok) throw new Error('socket token request failed');
        token = ((await res.json()) as { token: string }).token;
      } catch {
        if (!cancelled) setStatus('offline');
        return;
      }
      if (cancelled) return;

      // 3. Connect, authenticated with the same JWT as REST.
      socket = io(SOCKET_ORIGIN, { auth: { token }, transports: ['websocket', 'polling'] });

      socket.on('connect', () => setStatus('live'));
      socket.on('disconnect', () => setStatus('offline'));
      socket.on('connect_error', () => setStatus('offline'));
      socket.on('unauthorized', (payload: { message?: string }) => {
        setStatus('offline');
        setError(payload?.message ?? 'Socket authentication rejected');
      });

      // A delivered lead — acknowledge receipt, then prepend to the feed.
      socket.on('lead.delivered', (payload: LeadItem, ack?: (response: unknown) => void) => {
        if (typeof ack === 'function') {
          ack({ received: true }); // confirms delivery → server marks DELIVERED
        }
        setLeads((prev) =>
          prev.some((lead) => lead.assignmentId === payload.assignmentId)
            ? prev
            : [{ ...payload, deliveryStatus: 'DELIVERED' }, ...prev],
        );
      });

      socket.on('payment.paid', (payload: { publicOrderId?: string }) => {
        setNotice(`Payment received for order ${payload?.publicOrderId ?? ''}`);
      });
      socket.on('order.status_changed', (payload: { publicOrderId?: string; status?: string }) => {
        setNotice(`Order ${payload?.publicOrderId ?? ''} is now ${payload?.status ?? 'updated'}`);
      });
    }

    void start();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);

  const visible = tab === 'today' ? leads.filter((lead) => isToday(lead.createdAt)) : leads;
  const badge: Record<ConnectionStatus, { label: string; className: string }> = {
    connecting: { label: '● connecting', className: 'text-amber-400' },
    live: { label: '● live', className: 'text-emerald-400' },
    offline: { label: '● offline', className: 'text-red-400' },
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Live Leads</h1>
          <p className="text-sm text-slate-500">New leads stream in the moment they are delivered.</p>
        </div>
        <span className={`text-sm font-medium ${badge[status].className}`}>{badge[status].label}</span>
      </header>

      {notice && (
        <div className="rounded-md border border-blue-800 bg-blue-950/50 px-3 py-2 text-sm text-blue-200">
          {notice}
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-1">
        {(['today', 'all'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === key
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            {key === 'today' ? "Today's Leads" : 'My Leads'}
          </button>
        ))}
      </div>

      <Panel title={`${tab === 'today' ? "Today's Leads" : 'My Leads'} (${visible.length})`}>
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">
            No leads yet — delivered leads appear here instantly.
          </p>
        ) : (
          <Table
            headers={['Lead', 'Type', 'Name', 'Phone', 'State', 'Status']}
            rows={visible.map((lead) => [
              <span key="id" className="font-mono text-xs">
                {lead.publicLeadId}
              </span>,
              lead.leadType,
              lead.fullName ?? '—',
              lead.phone ?? '—',
              lead.state ?? '—',
              lead.deliveryStatus,
            ])}
          />
        )}
      </Panel>
    </div>
  );
}
