'use client';

import { BarChart3, Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { BulkImportDialog } from '@/components/BulkImportDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditDialog } from '@/components/EditDialog';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { LandingPageDetailSheet } from '@/components/LandingPageDetailSheet';
import { RowActions } from '@/components/RowActions';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { useEntityActions } from '@/hooks/use-entity-actions';
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
  status: 'WORKING' | 'PUBLISHED';
  intake_secret: string;
  field_map?: Record<string, unknown> | null;
}

/** Landing pages. All staff can view; ADMIN/SUPER_ADMIN can manage. */
export function LandingPagesScreen({ role }: { role: string }) {
  const canManage = role !== 'AGENT';
  const { data: pages, loading, error, reload } = useResource<LandingRow>('landing-pages');
  const a = useEntityActions<LandingRow>('landing-pages', reload);
  /** The page open in the right-side control-center drawer. */
  const [detail, setDetail] = useState<LandingRow | null>(null);

  const allChecked = pages.length > 0 && a.selected.size === pages.length;
  const someChecked = a.selected.size > 0 && !allChecked;

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    const fieldMap = parseFieldMap(str(fd.get('field_map')));
    await apiSend('POST', 'landing-pages', {
      ...clean({
        lead_type: str(fd.get('lead_type')),
        name: str(fd.get('name')),
        web_link: opt(fd.get('web_link')),
        status: str(fd.get('status')),
        intake_secret: opt(fd.get('intake_secret')),
      }),
      ...(fieldMap ? { field_map: fieldMap } : {}),
    });
    await reload();
    toast.success('Landing page created');
  }

  async function onEditSubmit(form: HTMLFormElement): Promise<void> {
    if (!a.editing) return;
    const fd = new FormData(form);
    const fieldMap = parseFieldMap(str(fd.get('field_map')));
    await apiSend('PATCH', `landing-pages/${a.editing.id}`, {
      ...clean({
        lead_type: opt(fd.get('lead_type')),
        name: opt(fd.get('name')),
        web_link: opt(fd.get('web_link')),
        status: opt(fd.get('status')),
      }),
      ...(fieldMap ? { field_map: fieldMap } : {}),
    });
    await reload();
    toast.success(`${a.editing.name} updated`);
  }

  /** Toggle WORKING ↔ PUBLISHED via the same PATCH endpoint. */
  async function togglePublished(page: LandingRow): Promise<void> {
    const next = page.status === 'PUBLISHED' ? 'WORKING' : 'PUBLISHED';
    try {
      await apiSend('PATCH', `landing-pages/${page.id}`, { status: next });
      await reload();
      toast.success(`${page.name} is now ${next.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Status change failed');
    }
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
              onSubmit={onCreate}
            >
              <LandingPageFields />
            </FormDialog>
          ) : null
        }
      />

      {canManage && (
        <BulkActionsBar
          count={a.selected.size}
          onClear={a.clear}
          onDelete={() => a.setBulkConfirm('delete')}
          pending={a.pending}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton columns={canManage ? 7 : 5} rows={5} />
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
                  {canManage && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onCheckedChange={(c) => a.toggleAll(pages, c === true)}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Web link</TableHead>
                  <TableHead>Intake secret</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p) => (
                  <TableRow key={p.id} data-state={a.isSelected(p.id) ? 'selected' : undefined}>
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={a.isSelected(p.id)}
                          onCheckedChange={() => a.toggleOne(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setDetail(p)}
                        className="text-left font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {p.name}
                      </button>
                    </TableCell>
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
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDetail(p)}
                          >
                            <BarChart3 className="size-3.5" />
                            Details
                          </Button>
                          <BulkImportDialog landingPage={p} />
                          <RowActions
                            onEdit={() => a.setEditing(p)}
                            onActivate={
                              p.status === 'WORKING' ? () => void togglePublished(p) : undefined
                            }
                            onDeactivate={
                              p.status === 'PUBLISHED' ? () => void togglePublished(p) : undefined
                            }
                            status={p.status === 'PUBLISHED' ? 'ACTIVE' : 'SUSPENDED'}
                            onDelete={() => a.setDeletingOne(p)}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {a.editing && (
        <EditDialog
          open
          onOpenChange={(o) => !o && a.setEditing(null)}
          title={`Edit ${a.editing.name}`}
          description="Intake secret can't be rotated here — recreate the page if you need a fresh one."
          contentClassName="max-w-xl"
          onSubmit={onEditSubmit}
        >
          <LandingPageFields
            defaults={{
              lead_type: a.editing.lead_type,
              status: a.editing.status,
              name: a.editing.name,
              web_link: a.editing.web_link ?? '',
              field_map: a.editing.field_map
                ? JSON.stringify(a.editing.field_map)
                : '',
            }}
            hideIntakeSecret
          />
        </EditDialog>
      )}

      <ConfirmDialog
        open={a.deletingOne !== null}
        onOpenChange={(o) => !o && a.setDeletingOne(null)}
        title={`Delete ${a.deletingOne?.name}?`}
        description="Pages referenced by captured leads can't be hard-deleted. Switch to WORKING (unpublished) instead."
        confirmLabel="Delete landing page"
        destructive
        onConfirm={async () => {
          if (a.deletingOne) await a.deleteIds([a.deletingOne.id]);
        }}
      />

      <ConfirmDialog
        open={a.bulkConfirm === 'delete'}
        onOpenChange={(o) => !o && a.setBulkConfirm(null)}
        title={`Delete ${a.selected.size} landing pages?`}
        description="Pages with captured leads can't be hard-deleted and will be skipped."
        confirmLabel="Delete"
        destructive
        onConfirm={() => a.deleteIds(a.selectedIds)}
      />

      <LandingPageDetailSheet
        page={detail}
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        onSecretRotated={reload}
      />
    </div>
  );
}

function parseFieldMap(raw: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Field map must be valid JSON.');
  }
}

/** Truncated secret with click-to-copy. */
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

/** Shared form fields for both Create and Edit. */
function LandingPageFields({
  defaults,
  hideIntakeSecret = false,
}: {
  defaults?: {
    lead_type?: string;
    status?: string;
    name?: string;
    web_link?: string;
    field_map?: string;
  };
  hideIntakeSecret?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Lead type">
        <Select name="lead_type" defaultValue={defaults?.lead_type ?? 'SOLAR'}>
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
        <Select name="status" defaultValue={defaults?.status ?? 'WORKING'}>
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
        <Input name="name" defaultValue={defaults?.name ?? ''} required />
      </Field>
      <Field label="Web link" className="sm:col-span-2">
        <Input
          name="web_link"
          type="url"
          placeholder="https://…"
          defaultValue={defaults?.web_link ?? ''}
        />
      </Field>
      {!hideIntakeSecret && (
        <Field label="Intake secret" hint="leave blank for auto" className="sm:col-span-2">
          <Input name="intake_secret" minLength={16} />
        </Field>
      )}
      <Field label="Field map JSON" hint="optional" className="sm:col-span-2">
        <Input
          name="field_map"
          placeholder='{"email":"email_addr","phone":"contact_phone"}'
          defaultValue={defaults?.field_map ?? ''}
        />
      </Field>
    </div>
  );
}
