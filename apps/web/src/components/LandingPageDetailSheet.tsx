'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatCard } from '@/components/dashboard/StatCard';
import { apiGet, apiSend } from '@/lib/proxy-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface LandingPage {
  id: string;
  name: string;
  lead_type: string;
  status: 'WORKING' | 'PUBLISHED';
  intake_secret: string;
  web_link: string | null;
  field_map?: Record<string, unknown> | null;
}

interface Metrics {
  counts: { total: number; today: number; last7: number };
  byState: { state: string; count: number }[];
  byRejectReason: { reason: string; count: number }[];
  series: { date: string; total: number; valid: number; rejected: number }[];
  recent: Array<{
    id: string;
    public_lead_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    lead_state: string;
    reject_reason: string | null;
    captured_at: string;
  }>;
}

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  UNSOLD_POOL: 'outline',
  RESERVED: 'secondary',
  ASSIGNED: 'secondary',
  DELIVERED: 'default',
  REJECTED: 'destructive',
  REPLACED: 'destructive',
  VALID: 'default',
  NEW: 'outline',
};

const chartConfig: ChartConfig = {
  valid: { label: 'Valid', color: 'var(--chart-2)' },
  rejected: { label: 'Rejected', color: 'var(--destructive)' },
};

const shortDate = (iso: string): string => iso.slice(5).replace('-', '/');
const fmt = (n: number): string => n.toLocaleString();

/**
 * Right-sheet control center for a single landing page. Shows the live
 * webhook URL (intake URL + secret with copy buttons), key metrics, a
 * 14-day capture chart, state + reject-reason breakdowns, the latest 20
 * intakes, and secret-rotation controls.
 */
export function LandingPageDetailSheet({
  page,
  open,
  onOpenChange,
  onSecretRotated,
}: {
  page: LandingPage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired so the parent list can refresh after a rotate. */
  onSecretRotated?: () => void;
}) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotated, setRotated] = useState<string | null>(null);

  const intakeUrl = page ? `${API_URL}/intake/${page.id}/lead` : '';
  // After rotation we surface the fresh secret ONCE inside the sheet so the
  // operator can copy it without leaving the screen.
  const currentSecret = rotated ?? page?.intake_secret ?? '';

  const reload = useCallback(async () => {
    if (!page) return;
    setMetrics(null);
    setError(null);
    try {
      setMetrics(await apiGet<Metrics>(`landing-pages/${page.id}/metrics`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    }
  }, [page]);

  useEffect(() => {
    if (open) {
      setRotated(null);
      void reload();
    }
  }, [open, reload]);

  async function rotate(): Promise<void> {
    if (!page) return;
    try {
      const result = await apiSend<{ intake_secret: string }>(
        'POST',
        `landing-pages/${page.id}/rotate-secret`,
        {},
      );
      setRotated(result.intake_secret);
      toast.success('Intake secret rotated. Update your WordPress side now.');
      onSecretRotated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rotate failed');
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
          <SheetHeader className="space-y-3 border-b border-border pb-4">
            <SheetTitle className="text-base">{page?.name ?? 'Landing page'}</SheetTitle>
            {page && (
              <>
                <SheetDescription>
                  Per-page control center — webhook configuration, capture metrics, and the
                  signing secret.
                </SheetDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{page.lead_type.toLowerCase()}</Badge>
                  <Badge variant={page.status === 'PUBLISHED' ? 'default' : 'outline'}>
                    {page.status.toLowerCase()}
                  </Badge>
                  {page.web_link && (
                    <a
                      href={page.web_link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Open page
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </>
            )}
          </SheetHeader>

          {!page ? null : error ? (
            <p className="px-6 py-8 text-sm text-destructive">{error}</p>
          ) : (
            <div className="space-y-6 px-6 py-6 text-sm">
              {/* Webhook integration */}
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Webhook integration
                </h3>
                <CopyField label="Intake URL" value={intakeUrl} />
                <CopyField label="Intake secret" value={currentSecret} secret />
                {rotated && (
                  <p className="rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mr-1 inline size-3.5 -translate-y-0.5" />
                    This is the only time the new secret is shown in plain view. Copy it now and
                    paste it into the WordPress side — old requests signed with the previous
                    secret will be rejected.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmRotate(true)}
                  >
                    <KeyRound className="size-3.5" />
                    Rotate intake secret
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void reload()}
                  >
                    <RefreshCw className="size-3.5" />
                    Refresh metrics
                  </Button>
                </div>
              </section>

              <Separator />

              {/* Capture metrics */}
              <section className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Capture metrics
                </h3>
                {!metrics ? (
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Today" value={fmt(metrics.counts.today)} icon={Activity} />
                    <StatCard label="Last 7 days" value={fmt(metrics.counts.last7)} />
                    <StatCard label="All time" value={fmt(metrics.counts.total)} />
                  </div>
                )}

                {metrics && metrics.series.length > 0 && (
                  <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <BarChart data={metrics.series} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                      />
                      <YAxis tickLine={false} axisLine={false} width={28} />
                      <RechartsTooltip
                        cursor={{ fill: 'var(--muted)' }}
                        content={
                          <ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />
                        }
                      />
                      <Bar
                        dataKey="valid"
                        fill="var(--color-valid)"
                        radius={[4, 4, 0, 0]}
                        stackId="cap"
                      />
                      <Bar
                        dataKey="rejected"
                        fill="var(--color-rejected)"
                        radius={[4, 4, 0, 0]}
                        stackId="cap"
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </section>

              <Separator />

              {/* Breakdowns */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Breakdown title="By state" rows={metrics?.byState ?? null} keyName="state" />
                <Breakdown
                  title="Rejection reasons"
                  rows={metrics?.byRejectReason ?? null}
                  keyName="reason"
                />
              </section>

              <Separator />

              {/* Recent intakes */}
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recent intakes
                </h3>
                {!metrics ? (
                  <Skeleton className="h-40 w-full" />
                ) : metrics.recent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No leads captured through this page yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {metrics.recent.map((lead) => (
                      <li
                        key={lead.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-muted-foreground">{lead.public_lead_id}</p>
                          <p className="truncate text-sm text-foreground">
                            {lead.full_name ?? lead.email ?? lead.phone ?? '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <Badge variant={STATE_VARIANT[lead.lead_state] ?? 'outline'}>
                            {lead.lead_state.toLowerCase().replace('_', ' ')}
                          </Badge>
                          <time className="tabular-nums text-muted-foreground">
                            {new Date(lead.captured_at).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Field map */}
              {page.field_map && Object.keys(page.field_map).length > 0 && (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Field map
                    </h3>
                    <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                      {JSON.stringify(page.field_map, null, 2)}
                    </pre>
                  </section>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Rotate the intake secret?"
        description="The old secret stops working immediately. Every request signed with the old secret will start returning 401 until you update the WordPress side."
        confirmLabel="Rotate secret"
        destructive
        onConfirm={async () => {
          await rotate();
        }}
      />
    </>
  );
}

/** Read-only field with click-to-copy + optional masked display. */
function CopyField({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const display = secret && !revealed ? '•'.repeat(Math.min(value.length, 40)) : value;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 truncate rounded-md border border-input bg-muted/40 px-2.5 py-1.5 text-xs">
          {display}
        </code>
        {secret && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide' : 'Reveal'}
          >
            <KeyRound className="size-3.5" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success(`${label} copied`);
            setTimeout(() => setCopied(false), 1500);
          }}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function Breakdown<T extends Record<string, unknown>>({
  title,
  rows,
  keyName,
}: {
  title: string;
  rows: T[] | null;
  keyName: keyof T;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      {rows === null ? (
        <Skeleton className="h-20 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row, i) => (
            <li
              // eslint-disable-next-line react/no-array-index-key
              key={`${String(row[keyName])}-${i}`}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
            >
              <span className="text-muted-foreground">
                {String(row[keyName]).toLowerCase().replace(/_/g, ' ')}
              </span>
              <span className="font-medium tabular-nums">{fmt(row.count as number)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

