'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Bell, Phone, Wifi, WifiOff, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { apiGet } from '@/lib/proxy-client';
import { cn } from '@/lib/utils';

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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DELIVERED: 'default',
  PENDING: 'outline',
  FAILED: 'destructive',
};

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function LiveLeadsScreen() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function start(): Promise<void> {
      try {
        const initial = await apiGet<LeadItem[]>('leads/mine');
        if (!cancelled) setLeads(initial);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leads');
      }

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

  const today = leads.filter((lead) => isToday(lead.createdAt));

  return (
    <div>
      <PageHeader
        eyebrow="Live"
        title="Live leads"
        description="New leads stream in the moment they are delivered."
        actions={<ConnectionPill status={status} />}
      />

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
          <Bell className="size-4 text-primary" />
          {notice}
        </div>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">
            Today's leads
            <span className="ml-1 text-xs text-muted-foreground">({today.length})</span>
          </TabsTrigger>
          <TabsTrigger value="all">
            All leads
            <span className="ml-1 text-xs text-muted-foreground">({leads.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <LeadsTable rows={today} emptyMessage="No leads delivered today yet." />
        </TabsContent>
        <TabsContent value="all">
          <LeadsTable
            rows={leads}
            emptyMessage="No leads delivered yet — they appear here instantly."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const meta = {
    connecting: {
      label: 'Connecting',
      Icon: Wifi,
      className: 'text-amber-700 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300',
      pulse: true,
    },
    live: {
      label: 'Live',
      Icon: Zap,
      className: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300',
      pulse: true,
    },
    offline: {
      label: 'Offline',
      Icon: WifiOff,
      className: 'text-destructive bg-destructive/10',
      pulse: false,
    },
  }[status];
  const { Icon } = meta;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        meta.className,
      )}
    >
      <span className="relative flex size-2 items-center justify-center">
        <span
          className={cn(
            'absolute inline-flex size-2 rounded-full bg-current',
            meta.pulse && 'animate-ping opacity-75',
          )}
        />
        <span className="relative inline-flex size-1.5 rounded-full bg-current" />
      </span>
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  );
}

function LeadsTable({ rows, emptyMessage }: { rows: LeadItem[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState icon={Zap} title="No leads here" description={emptyMessage} />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((lead) => (
              <TableRow key={lead.assignmentId}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(lead.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-xs">{lead.publicLeadId}</TableCell>
                <TableCell className="text-sm capitalize">
                  {lead.leadType.toLowerCase()}
                </TableCell>
                <TableCell className="text-sm">{lead.fullName ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="size-3.5" />
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lead.state ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lead.deliveryStatus] ?? 'outline'}>
                    {lead.deliveryStatus.toLowerCase()}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
