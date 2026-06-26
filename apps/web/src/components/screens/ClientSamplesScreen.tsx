'use client';

import { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { num, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const DELIVERY_MODES = ['EXCLUSIVE', 'SHARED'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  FORWARDED: 'default',
  ASSIGNED: 'default',
  REJECTED: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'pending',
  FORWARDED: 'forwarded',
  ASSIGNED: 'assigned',
  REJECTED: 'rejected',
};

// Custom blue badge for FORWARDED
function StatusBadge({ status }: { status: string }) {
  if (status === 'FORWARDED') {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
        forwarded
      </Badge>
    );
  }
  if (status === 'ASSIGNED') {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
        assigned
      </Badge>
    );
  }
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
      {STATUS_LABEL[status] ?? status.toLowerCase()}
    </Badge>
  );
}

interface SampleRequestRow {
  id: string;
  public_id: string;
  lead_type: string;
  quantity: number;
  delivery_mode: string;
  state_filter: string | null;
  zip_filter: string | null;
  notes: string | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
  _count: { deliveries: number };
}

interface SampleLeadRow {
  deliveryId: string;
  requestPublicId: string;
  leadId: string;
  publicLeadId: string;
  leadType: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  zip: string | null;
  capturedAt: string;
  receivedAt: string;
}

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export function ClientSamplesScreen() {
  const { data: requests, loading: reqLoading, error: reqError, reload: reloadReqs } =
    useResource<SampleRequestRow>('samples/requests');
  const { data: sampleLeads, loading: leadsLoading, error: leadsError } =
    useResource<SampleLeadRow>('samples/my-leads');

  const [tab, setTab] = useState('requests');

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    await apiSend('POST', 'samples/requests', {
      lead_type: str(fd.get('lead_type')),
      quantity: num(fd.get('quantity')),
      delivery_mode: str(fd.get('delivery_mode')),
      ...(opt(fd.get('state_filter')) ? { state_filter: opt(fd.get('state_filter')) } : {}),
      ...(opt(fd.get('zip_filter')) ? { zip_filter: opt(fd.get('zip_filter')) } : {}),
      ...(opt(fd.get('notes')) ? { notes: opt(fd.get('notes')) } : {}),
    });
    await reloadReqs();
    toast.success('Sample request submitted — your agent will review it shortly.');
  }

  return (
    <div>
      <PageHeader
        eyebrow="Client"
        title="Samples"
        description="Request sample leads to evaluate before placing a full order."
        actions={
          <FormDialog
            triggerLabel="New sample request"
            title="Request sample leads"
            description="Submit a request for sample leads — your agent will review and forward to admin."
            submitLabel="Submit request"
            contentClassName="max-w-xl"
            onSubmit={onCreate}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Lead type">
                <Select name="lead_type" defaultValue="SOLAR">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Delivery mode">
                <Select name="delivery_mode" defaultValue="EXCLUSIVE">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quantity (1–20)">
                <Input name="quantity" type="number" min={1} max={20} defaultValue={5} required />
              </Field>
              <Field label="State filter" hint="optional">
                <Input name="state_filter" placeholder="e.g. CA, TX" />
              </Field>
              <Field label="ZIP filter" hint="optional">
                <Input name="zip_filter" placeholder="e.g. 90210" />
              </Field>
              <Field label="Notes" hint="optional" className="sm:col-span-2">
                <Textarea name="notes" rows={3} placeholder="Any specific requirements…" />
              </Field>
            </div>
          </FormDialog>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="leads">Sample Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardContent className="p-0">
              {reqLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : reqError ? (
                <p className="px-6 py-12 text-sm text-destructive">{reqError}</p>
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No sample requests yet"
                  description="Submit a sample request to evaluate leads before placing a full order."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.public_id}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {r.lead_type.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {r.delivery_mode.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r._count.deliveries}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={r.status} />
                            {r.reject_reason && (
                              <span className="text-xs text-muted-foreground">{r.reject_reason}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {dateTime(r.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardContent className="p-0">
              {leadsLoading ? (
                <TableSkeleton columns={8} rows={5} />
              ) : leadsError ? (
                <p className="px-6 py-12 text-sm text-destructive">{leadsError}</p>
              ) : sampleLeads.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No sample leads yet"
                  description="Sample leads assigned to you will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleLeads.map((l) => (
                      <TableRow key={l.deliveryId}>
                        <TableCell className="font-mono text-xs">{l.requestPublicId}</TableCell>
                        <TableCell className="font-mono text-xs">{l.publicLeadId}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {l.leadType.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-sm">{l.fullName ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.email ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.phone ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">{l.state ?? '—'}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {dateTime(l.receivedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
