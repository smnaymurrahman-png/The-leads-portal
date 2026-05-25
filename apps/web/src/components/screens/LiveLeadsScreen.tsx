'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Phone, Wifi, WifiOff, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  type ConnectionStatus,
  type LiveLeadItem,
  useNotifications,
} from '@/components/NotificationsProvider';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { apiGet } from '@/lib/proxy-client';
import { cn } from '@/lib/utils';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];

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

/**
 * Client-side live feed. The Socket.IO connection itself is owned by the
 * app-wide NotificationsProvider so the bell stays accurate even when the
 * user navigates away — this screen just seeds and reads from that store.
 */
export function LiveLeadsScreen() {
  const { liveLeads, seedLiveLeads, status } = useNotifications();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    void (async () => {
      try {
        const initial = await apiGet<LiveLeadItem[]>('leads/mine');
        seedLiveLeads(initial);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load leads');
      }
    })();
  }, [seedLiveLeads]);

  // Narrow leadgs by lead-type + free-text search across name/email/phone/state.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return liveLeads.filter((lead) => {
      if (typeFilter !== 'ALL' && lead.leadType !== typeFilter) return false;
      if (!q) return true;
      return (
        lead.publicLeadId.toLowerCase().includes(q) ||
        (lead.fullName?.toLowerCase().includes(q) ?? false) ||
        (lead.email?.toLowerCase().includes(q) ?? false) ||
        (lead.phone?.toLowerCase().includes(q) ?? false) ||
        (lead.state?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [liveLeads, query, typeFilter]);

  const today = filtered.filter((lead) => isToday(lead.createdAt));

  function downloadCsv(): void {
    if (filtered.length === 0) return;
    const header = [
      'public_lead_id',
      'lead_type',
      'full_name',
      'email',
      'phone',
      'state',
      'delivered_at',
    ];
    const rows = filtered.map((l) => [
      l.publicLeadId,
      l.leadType,
      l.fullName ?? '',
      l.email ?? '',
      l.phone ?? '',
      l.state ?? '',
      l.createdAt,
    ]);
    const escape = (v: string): string =>
      /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        eyebrow="My leads"
        title="Leads delivered to you"
        description="A live feed of everything that's landed in your account. Filter or search to find a specific lead, export to CSV for your CRM."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              disabled={filtered.length === 0}
              title="Download current view as CSV"
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <ConnectionPill status={status} />
          </div>
        }
      />

      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="search"
          placeholder="Search by lead id, name, email, phone, state…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'ALL')}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {LEAD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">
            Today's leads
            <span className="ml-1 text-xs text-muted-foreground">({today.length})</span>
          </TabsTrigger>
          <TabsTrigger value="all">
            All leads
            <span className="ml-1 text-xs text-muted-foreground">({filtered.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <LeadsTable
            rows={today}
            emptyMessage={
              query || typeFilter !== 'ALL'
                ? 'No leads delivered today match your filter.'
                : 'No leads delivered today yet.'
            }
          />
        </TabsContent>
        <TabsContent value="all">
          <LeadsTable
            rows={filtered}
            emptyMessage={
              query || typeFilter !== 'ALL'
                ? 'No leads match your filter. Try clearing it.'
                : 'No leads delivered yet — they appear here instantly.'
            }
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

function LeadsTable({ rows, emptyMessage }: { rows: LiveLeadItem[]; emptyMessage: string }) {
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
