'use client';

import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditDialog } from '@/components/EditDialog';
import { EmptyState } from '@/components/EmptyState';
import { Field, FormDialog } from '@/components/FormDialog';
import { RowActions } from '@/components/RowActions';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TableSkeleton } from '@/components/skeletons';
import { useEntityActions } from '@/hooks/use-entity-actions';
import { clean, num, opt, str } from '@/lib/form';
import { apiSend } from '@/lib/proxy-client';
import { useResource } from '@/lib/use-resource';

const ADS_TYPES = ['FACEBOOK', 'GOOGLE', 'TIKTOK', 'YOUTUBE', 'OTHER'];

const ADS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  FACEBOOK: 'default',
  GOOGLE: 'secondary',
  TIKTOK: 'outline',
  YOUTUBE: 'outline',
  OTHER: 'outline',
};

interface CampaignRow {
  id: string;
  name: string;
  ads_type: string;
  details: string | null;
  production_link: string | null;
  budget: string | null;
  day_count: number | null;
  results: unknown;
}

/** Campaigns. All staff can view; ADMIN/SUPER_ADMIN can manage. */
export function CampaignsScreen({ role }: { role: string }) {
  const canManage = role !== 'AGENT';
  const { data: campaigns, loading, error, reload } = useResource<CampaignRow>('campaigns');
  const a = useEntityActions<CampaignRow>('campaigns', reload);

  const allChecked = campaigns.length > 0 && a.selected.size === campaigns.length;
  const someChecked = a.selected.size > 0 && !allChecked;

  async function onCreate(form: HTMLFormElement): Promise<void> {
    const fd = new FormData(form);
    await apiSend(
      'POST',
      'campaigns',
      clean({
        name: str(fd.get('name')),
        ads_type: str(fd.get('ads_type')),
        details: opt(fd.get('details')),
        production_link: opt(fd.get('production_link')),
        budget: num(fd.get('budget')),
        day_count: num(fd.get('day_count')),
      }),
    );
    await reload();
    toast.success('Campaign created');
  }

  async function onEditSubmit(form: HTMLFormElement): Promise<void> {
    if (!a.editing) return;
    const fd = new FormData(form);
    await apiSend(
      'PATCH',
      `campaigns/${a.editing.id}`,
      clean({
        name: opt(fd.get('name')),
        ads_type: opt(fd.get('ads_type')),
        details: opt(fd.get('details')),
        production_link: opt(fd.get('production_link')),
        budget: num(fd.get('budget')),
        day_count: num(fd.get('day_count')),
      }),
    );
    await reload();
    toast.success(`${a.editing.name} updated`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Campaigns"
        description="Ad campaigns feeding the lead pipeline."
        actions={
          canManage ? (
            <FormDialog
              triggerLabel="New campaign"
              title="Create a campaign"
              description="A campaign tracks the spend that produced a batch of leads."
              submitLabel="Create campaign"
              onSubmit={onCreate}
            >
              <CampaignFields />
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
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description={
                canManage
                  ? 'Create a campaign to start tracking the ad spend that produced your leads.'
                  : 'Campaigns appear here once a manager creates them.'
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
                        onCheckedChange={(c) => a.toggleAll(campaigns, c === true)}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>Ads type</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Results</TableHead>
                  {canManage && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id} data-state={a.isSelected(c.id) ? 'selected' : undefined}>
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={a.isSelected(c.id)}
                          onCheckedChange={() => a.toggleOne(c.id)}
                          aria-label={`Select ${c.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={ADS_VARIANT[c.ads_type] ?? 'outline'}>
                        {c.ads_type.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.budget ? `$${Number(c.budget).toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.day_count ?? '—'}</TableCell>
                    <TableCell>
                      {c.results ? (
                        <code className="text-xs text-muted-foreground">
                          {JSON.stringify(c.results)}
                        </code>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <RowActions
                          onEdit={() => a.setEditing(c)}
                          onDelete={() => a.setDeletingOne(c)}
                        />
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
          onSubmit={onEditSubmit}
        >
          <CampaignFields
            defaults={{
              name: a.editing.name,
              ads_type: a.editing.ads_type,
              details: a.editing.details ?? '',
              production_link: a.editing.production_link ?? '',
              budget: a.editing.budget ?? '',
              day_count: a.editing.day_count ?? '',
            }}
          />
        </EditDialog>
      )}

      <ConfirmDialog
        open={a.deletingOne !== null}
        onOpenChange={(o) => !o && a.setDeletingOne(null)}
        title={`Delete ${a.deletingOne?.name}?`}
        description="This permanently removes the campaign. Leads attached to it stay, but their campaign reference goes away."
        confirmLabel="Delete campaign"
        destructive
        onConfirm={async () => {
          if (a.deletingOne) await a.deleteIds([a.deletingOne.id]);
        }}
      />

      <ConfirmDialog
        open={a.bulkConfirm === 'delete'}
        onOpenChange={(o) => !o && a.setBulkConfirm(null)}
        title={`Delete ${a.selected.size} campaigns?`}
        description="Campaigns referenced by leads can't be hard-deleted and will be skipped."
        confirmLabel="Delete"
        destructive
        onConfirm={() => a.deleteIds(a.selectedIds)}
      />
    </div>
  );
}

/** Shared form fields for both Create and Edit dialogs. */
function CampaignFields({
  defaults,
}: {
  defaults?: {
    name?: string;
    ads_type?: string;
    details?: string;
    production_link?: string;
    budget?: string | number;
    day_count?: string | number;
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={defaults?.name ?? ''} required />
      </Field>
      <Field label="Ads type">
        <Select name="ads_type" defaultValue={defaults?.ads_type ?? 'FACEBOOK'}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADS_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Production link">
        <Input
          name="production_link"
          type="url"
          defaultValue={defaults?.production_link ?? ''}
        />
      </Field>
      <Field label="Budget (USD)">
        <Input
          name="budget"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.budget ?? ''}
        />
      </Field>
      <Field label="Day count">
        <Input name="day_count" type="number" min={0} defaultValue={defaults?.day_count ?? ''} />
      </Field>
      <Field label="Details" className="sm:col-span-2">
        <Input name="details" defaultValue={defaults?.details ?? ''} />
      </Field>
    </div>
  );
}
