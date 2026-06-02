'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Inbox,
  Mail,
  Phone,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
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
import { StatCard } from '@/components/dashboard/StatCard';
import { apiGet } from '@/lib/proxy-client';
import { cn } from '@/lib/utils';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const STATUSES = ['DELIVERED', 'PENDING', 'FAILED'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DELIVERED: 'default',
  PENDING: 'outline',
  FAILED: 'destructive',
};

type Timeframe = 'today' | 'week' | 'all';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isToday(iso: string): boolean {
  return new Date(iso).getTime() >= startOfToday();
}

function isThisWeek(iso: string): boolean {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= sevenDaysAgo;
}

/** Time for today's leads, otherwise a short date — so the column stays compact. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return isToday(iso)
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

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

  // Summary tiles describe the whole account, independent of the active filters.
  const totals = useMemo(
    () => ({
      total: liveLeads.length,
      today: liveLeads.filter((l) => isToday(l.createdAt)).length,
      week: liveLeads.filter((l) => isThisWeek(l.createdAt)).length,
      delivered: liveLeads.filter((l) => l.deliveryStatus === 'DELIVERED').length,
    }),
    [liveLeads],
  );

  // Narrow by lead-type, delivery status, then free-text search.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return liveLeads.filter((lead) => {
      if (typeFilter !== 'ALL' && lead.leadType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && lead.deliveryStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        lead.publicLeadId.toLowerCase().includes(q) ||
        (lead.fullName?.toLowerCase().includes(q) ?? false) ||
        (lead.email?.toLowerCase().includes(q) ?? false) ||
        (lead.phone?.toLowerCase().includes(q) ?? false) ||
        (lead.state?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [liveLeads, query, typeFilter, statusFilter]);

  const timeframeCounts = useMemo(
    () => ({
      today: searched.filter((l) => isToday(l.createdAt)).length,
      week: searched.filter((l) => isThisWeek(l.createdAt)).length,
      all: searched.length,
    }),
    [searched],
  );

  const visible = useMemo(() => {
    if (timeframe === 'today') return searched.filter((l) => isToday(l.createdAt));
    if (timeframe === 'week') return searched.filter((l) => isThisWeek(l.createdAt));
    return searched;
  }, [searched, timeframe]);

  const hasFilters = query.trim() !== '' || typeFilter !== 'ALL' || statusFilter !== 'ALL';

  function downloadCsv(): void {
    if (visible.length === 0) return;
    const header = [
      'public_lead_id',
      'lead_type',
      'full_name',
      'email',
      'phone',
      'state',
      'status',
      'delivered_at',
    ];
    const rows = visible.map((l) => [
      l.publicLeadId,
      l.leadType,
      l.fullName ?? '',
      l.email ?? '',
      l.phone ?? '',
      l.state ?? '',
      l.deliveryStatus,
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

  const timeframes: { value: Timeframe; label: string; count: number }[] = [
    { value: 'today', label: 'Today', count: timeframeCounts.today },
    { value: 'week', label: 'Last 7 days', count: timeframeCounts.week },
    { value: 'all', label: 'All time', count: timeframeCounts.all },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="My leads"
        title="Leads delivered to you"
        description="A live feed of every lead that's landed in your account. Filter or search to find a specific lead, then export to CSV for your CRM."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              disabled={visible.length === 0}
              title="Download the current view as CSV"
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <ConnectionPill status={status} />
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total leads"
          value={totals.total.toLocaleString()}
          hint="Delivered to your account."
          icon={Inbox}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Today"
          value={totals.today.toLocaleString()}
          hint="Received since midnight."
          icon={CalendarClock}
        />
        <StatCard
          label="Last 7 days"
          value={totals.week.toLocaleString()}
          hint="Rolling weekly volume."
          icon={CalendarDays}
        />
        <StatCard
          label="Delivered"
          value={totals.delivered.toLocaleString()}
          hint="Confirmed delivered to you."
          icon={CheckCircle2}
        />
      </section>

      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search by lead id, name, email, phone, state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'ALL')}>
              <SelectTrigger className="w-40">
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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'ALL')}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="inline-flex w-fit items-center rounded-lg border bg-muted p-0.5">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors',
                timeframe === tf.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tf.label}
              <span className="text-xs tabular-nums opacity-70">({tf.count})</span>
            </button>
          ))}
        </div>
      </div>

      <LeadsTable
        rows={visible}
        emptyMessage={
          hasFilters
            ? 'No leads match your filters. Try clearing them.'
            : timeframe === 'today'
              ? 'No leads delivered today yet — new ones appear here instantly.'
              : 'No leads delivered yet — they appear here the moment they land.'
        }
      />
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
          <EmptyState icon={Clock} title="No leads here" description={emptyMessage} />
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
              <TableHead>Received</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((lead) => (
              <TableRow key={lead.assignmentId}>
                <TableCell
                  className="text-xs text-muted-foreground tabular-nums"
                  title={new Date(lead.createdAt).toLocaleString()}
                >
                  {formatWhen(lead.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-xs">{lead.publicLeadId}</TableCell>
                <TableCell className="text-sm capitalize">
                  {lead.leadType.toLowerCase()}
                </TableCell>
                <TableCell className="text-sm">{lead.fullName ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col gap-0.5">
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="size-3.5" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="size-3.5" />
                        {lead.phone}
                      </a>
                    )}
                    {!lead.email && !lead.phone && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
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
