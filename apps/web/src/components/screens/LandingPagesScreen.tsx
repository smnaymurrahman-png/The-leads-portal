'use client';

import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { clean, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'];
const STATUSES = ['WORKING', 'PUBLISHED'];

const LEAD_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  SOLAR: 'default',
  SWEEPSTAKES: 'secondary',
  PAYDAY: 'outline',
  HOMEOWNER: 'outline',
};

interface LandingRow {
  id: string;
  lead_type: string;
  name: string;
  web_link: string | null;
  status: string;
  intake_secret: string;
}

/** Landing pages. All staff can view; ADMIN/SUPER_ADMIN can create. */
export function LandingPagesScreen({ role }: { role: string }) {
  const canManage = role !== 'AGENT';
  const { data: pages, loading, error, reload } = useResource<LandingRow>('landing-pages');

  async function onSubmit(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);

    // field_map is an optional JSON object typed into a textarea-like input.
    let field_map: Record<string, unknown> | undefined;
    const rawMap = str(fd.get('field_map'));
    if (rawMap) {
      try {
        field_map = JSON.parse(rawMap) as Record<string, unknown>;
      } catch {
        throw new Error('Field map must be valid JSON.');
      }
    }

    await apiSend('POST', 'landing-pages', {
      ...clean({
        lead_type: str(fd.get('lead_type')),
        name: str(fd.get('name')),
        web_link: opt(fd.get('web_link')),
        status: str(fd.get('status')),
        intake_secret: opt(fd.get('intake_secret')),
      }),
      ...(field_map ? { field_map } : {}),
    });
    await reload();
    toast.success('Landing page created');
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Landing pages"
        description="Lead-capture pages and their intake secrets. Each page has a signed webhook for the intake endpoint."
        actions={
          canManage ? (
            <FormDialog
              triggerLabel="New landing page"
              title="Create a landing page"
              description="An intake secret is auto-generated unless you supply one."
              submitLabel="Create landing page"
              contentClassName="max-w-xl"
              onSubmit={onSubmit}
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
                <Field label="Status">
                  <Select name="status" defaultValue="WORKING">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Name" className="sm:col-span-2">
                  <Input name="name" required />
                </Field>
                <Field label="Web link" className="sm:col-span-2">
                  <Input name="web_link" type="url" placeholder="https://…" />
                </Field>
                <Field label="Intake secret" hint="leave blank for auto" className="sm:col-span-2">
                  <Input name="intake_secret" minLength={16} />
                </Field>
                <Field label="Field map JSON" hint="optional" className="sm:col-span-2">
                  <Input
                    name="field_map"
                    placeholder='{"email":"email_addr","phone":"contact_phone"}'
                  />
                </Field>
              </div>
            </FormDialog>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={5} rows={5} />
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : pages.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No landing pages yet"
              description={
                canManage
                  ? 'Create your first landing page to start receiving signed lead intakes.'
                  : 'Pages appear here once a manager publishes them.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Web link</TableHead>
                  <TableHead>Intake secret</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={LEAD_TYPE_VARIANT[p.lead_type] ?? 'outline'}>
                        {p.lead_type.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'PUBLISHED' ? 'default' : 'outline'}>
                        {p.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.web_link ? (
                        <a
                          href={p.web_link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          Open
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SecretCell value={p.intake_secret} />
                    </TableCell>
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

/** Truncated secret with a click-to-copy. */
function SecretCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <code className="text-xs text-muted-foreground">{value.slice(0, 12)}…</code>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success('Intake secret copied');
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy secret"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </Button>
    </div>
  );
}
