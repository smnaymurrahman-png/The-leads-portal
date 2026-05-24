'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Mail, MapPin, Phone, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/proxy-client';

interface LeadDetail {
  id: string;
  public_lead_id: string;
  lead_type: string;
  lead_state: string;
  reject_reason: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  zip: string | null;
  state: string | null;
  country: string | null;
  source_url: string | null;
  submission_id: string;
  consent_text: string | null;
  consent_ip: string | null;
  consent_at: string | null;
  qualification: Record<string, unknown> | null;
  captured_at: string;
  landing_page: { id: string; name: string; lead_type: string } | null;
  assignments: Array<{
    id: string;
    delivery_status: string;
    delivered_at: string | null;
    created_at: string;
    client: { id: string; full_name: string; business_name: string | null } | null;
    order: { id: string; public_order_id: string; status: string } | null;
  }>;
}

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  UNSOLD_POOL: 'outline',
  RESERVED: 'secondary',
  ASSIGNED: 'secondary',
  DELIVERED: 'default',
  REJECTED: 'destructive',
  REPLACED: 'destructive',
};

/** Right-sliding drawer with the full record for a single lead. */
export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leadId) return;
    setLead(null);
    setError(null);
    void (async () => {
      try {
        setLead(await apiGet<LeadDetail>(`leads/${leadId}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load lead');
      }
    })();
  }, [leadId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-3 border-b border-border pb-4">
          <SheetTitle className="font-mono text-base">
            {lead?.public_lead_id ?? 'Lead detail'}
          </SheetTitle>
          <SheetDescription>
            {lead
              ? `Captured ${new Date(lead.captured_at).toLocaleString()}`
              : 'Loading the lead record…'}
          </SheetDescription>
          {lead && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{lead.lead_type.toLowerCase()}</Badge>
              <Badge variant={STATE_VARIANT[lead.lead_state] ?? 'outline'}>
                {lead.lead_state.toLowerCase().replace('_', ' ')}
              </Badge>
              {lead.reject_reason && (
                <Badge variant="destructive">
                  {lead.reject_reason.toLowerCase().replace('_', ' ')}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {error ? (
          <p className="px-6 py-8 text-sm text-destructive">{error}</p>
        ) : !lead ? (
          <div className="space-y-3 px-6 py-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6 px-6 py-6 text-sm">
            <Section title="Contact">
              <KV
                label="Name"
                value={lead.full_name ?? <span className="text-muted-foreground">—</span>}
              />
              <KV
                label="Email"
                value={
                  lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Mail className="size-3.5 text-muted-foreground" />
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <KV
                label="Phone"
                value={
                  lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Phone className="size-3.5 text-muted-foreground" />
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <KV
                label="Address"
                value={lead.address ?? <span className="text-muted-foreground">—</span>}
              />
              <KV
                label="Geo"
                value={
                  lead.zip || lead.state || lead.country ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      {[lead.zip, lead.state, lead.country].filter(Boolean).join(' · ')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
            </Section>

            <Separator />

            <Section title="Capture">
              <KV
                label="Landing page"
                value={lead.landing_page?.name ?? <span className="text-muted-foreground">—</span>}
              />
              <KV
                label="Source URL"
                value={
                  lead.source_url ? (
                    <a
                      href={lead.source_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                      <span className="break-all">{lead.source_url}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <KV
                label="Submission id"
                value={<code className="text-xs">{lead.submission_id}</code>}
              />
              {lead.consent_text && <KV label="Consent" value={lead.consent_text} />}
              {lead.consent_ip && (
                <KV
                  label="Consent IP"
                  value={<code className="text-xs">{lead.consent_ip}</code>}
                />
              )}
            </Section>

            {lead.qualification && Object.keys(lead.qualification).length > 0 && (
              <>
                <Separator />
                <Section title="Qualification" icon={Tag}>
                  <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                    {JSON.stringify(lead.qualification, null, 2)}
                  </pre>
                </Section>
              </>
            )}

            <Separator />

            <Section title={`Assignments (${lead.assignments.length})`}>
              {lead.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not yet assigned to an order.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lead.assignments.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-md border border-border bg-card/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {a.client?.business_name ?? a.client?.full_name ?? '—'}
                          </p>
                          {a.order && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {a.order.public_order_id}
                            </p>
                          )}
                        </div>
                        <Badge variant={STATE_VARIANT[a.delivery_status] ?? 'outline'}>
                          {a.delivery_status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned {new Date(a.created_at).toLocaleString()}
                        {a.delivered_at &&
                          ` · delivered ${new Date(a.delivered_at).toLocaleString()}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
