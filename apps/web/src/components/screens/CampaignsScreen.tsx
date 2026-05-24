'use client';

import { Badge } from '@/components/ui/badge';
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
import { Field, FormDialog } from '@/components/FormDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
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
  budget: string | null;
  day_count: number | null;
  results: unknown;
}

/** Campaigns. All staff can view; ADMIN/SUPER_ADMIN can create. */
export function CampaignsScreen({ role }: { role: string }) {
  const canManage = role !== 'AGENT';
  const { data: campaigns, loading, error, reload } = useResource<CampaignRow>('campaigns');

  async function onSubmit(form: HTMLFormElement): Promise<void> {
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
              onSubmit={onSubmit}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name" className="sm:col-span-2">
                  <Input name="name" required />
                </Field>
                <Field label="Ads type">
                  <Select name="ads_type" defaultValue="FACEBOOK">
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
                  <Input name="production_link" type="url" />
                </Field>
                <Field label="Budget (USD)">
                  <Input name="budget" type="number" min={0} step="0.01" />
                </Field>
                <Field label="Day count">
                  <Input name="day_count" type="number" min={0} />
                </Field>
                <Field label="Details" className="sm:col-span-2">
                  <Input name="details" />
                </Field>
              </div>
            </FormDialog>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-12 text-sm text-muted-foreground">Loading campaigns…</p>
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : campaigns.length === 0 ? (
            <p className="px-6 py-12 text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Ads type</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
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
