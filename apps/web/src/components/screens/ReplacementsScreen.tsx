'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Field, FormDialog } from '@/components/FormDialog';
import { usePromptDialog } from '@/components/PromptDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  REQUESTED: 'outline',
  REVIEW: 'secondary',
  APPROVED: 'default',
  DENIED: 'destructive',
  FULFILLED: 'default',
  EXPIRED: 'destructive',
};

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [askReason, promptMount] = usePromptDialog();

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

  async function onSubmit(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    await apiSend('POST', 'replacements', {
      original_lead_id: fd.get('original_lead_id'),
      reason: fd.get('reason'),
    });
    await reload();
    toast.success('Replacement request submitted');
  }

  async function review(id: string, action: 'approve' | 'deny'): Promise<void> {
    let body: unknown = {};
    if (action === 'deny') {
      const note = await askReason({
        title: 'Deny this replacement',
        description: 'The client will see this note next to the denied status.',
        label: 'Reason',
        placeholder: 'Why is the replacement being denied?',
        confirmLabel: 'Deny replacement',
        destructive: true,
      });
      if (!note) return;
      body = { note };
    }
    setBusyId(id);
    try {
      await apiSend('POST', `replacements/${id}/${action}`, body);
      await reload();
      toast.success(
        action === 'approve' ? 'Replacement approved — fresh lead issued' : 'Replacement denied',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  function rowActions(row: ReplacementRow) {
    if (isReviewer && ACTIVE_STATUSES.has(row.status)) {
      return (
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={busyId === row.id}
            onClick={() => void review(row.id, 'approve')}
          >
            {busyId === row.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busyId === row.id}
            onClick={() => void review(row.id, 'deny')}
          >
            <X className="size-3.5" />
            Deny
          </Button>
        </div>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div>
      <PageHeader
        eyebrow={isReviewer ? 'Operations' : 'Client'}
        title="Replacements"
        description={
          isClient
            ? 'Request a replacement on a delivered lead and track its outcome.'
            : isReviewer
              ? 'Review replacement requests — approve to issue a fresh coded lead.'
              : 'Replacement requests from your clients (view only).'
        }
        actions={
          isClient && deliveredLeads.length > 0 ? (
            <FormDialog
              triggerLabel="Request replacement"
              title="Request a replacement"
              description={
                windowHours !== null
                  ? `Requests must be made within ${windowHours}h of delivery.`
                  : 'Pick the delivered lead and the reason — we review every request.'
              }
              submitLabel="Submit request"
              onSubmit={onSubmit}
            >
              <div className="space-y-3">
                <Field label="Delivered lead">
                  <Select name="original_lead_id">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveredLeads.map((lead) => (
                        <SelectItem key={lead.leadId} value={lead.leadId}>
                          {lead.publicLeadId}
                          {lead.fullName ? ` — ${lead.fullName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reason">
                  <Select name="reason">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason.toLowerCase().replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormDialog>
          ) : null
        }
      />

      {promptMount}

      {isClient && deliveredLeads.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          You have no delivered leads available to replace yet.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={7} rows={5} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title={isReviewer ? 'Nothing to review' : 'No replacements yet'}
              description={
                isClient
                  ? 'Request a replacement on a delivered lead and it will show up here.'
                  : isReviewer
                    ? 'New replacement requests will appear here for your review.'
                    : "Replacement requests from your clients will appear here."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Original lead</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>New lead</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      {row.original_lead?.public_lead_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.client?.business_name ?? row.client?.full_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.reason?.toLowerCase().replace('_', ' ') ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'}>
                          {row.status.toLowerCase()}
                        </Badge>
                        {row.review_note && (
                          <span className="text-xs text-muted-foreground">{row.review_note}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.replacement_code ? (
                        <code className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {row.replacement_code}
                        </code>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.replacement_lead?.public_lead_id ?? '—'}
                    </TableCell>
                    <TableCell>{rowActions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
