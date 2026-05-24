'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiSend } from '@/lib/proxy-client';

interface LandingPage {
  id: string;
  name: string;
  field_map?: Record<string, unknown> | null;
}

interface RowResult {
  state: string;
  rejectReason: string | null;
  idempotent: boolean;
  error?: string;
}

/**
 * Tiny RFC4180-flavoured CSV parser. Handles quoted fields, embedded commas
 * and "" escapes. Returns an array of objects keyed by the header row. We
 * inline this rather than add a dep — the worst-case input is a few thousand
 * rows of pure ASCII.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [[]];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      rows[rows.length - 1].push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      rows[rows.length - 1].push(field);
      field = '';
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      i += 1;
      // Skip blank trailing lines.
      if (i < text.length) rows.push([]);
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== '' || rows[rows.length - 1].length > 0) {
    rows[rows.length - 1].push(field);
  }
  const [headerRow, ...dataRows] = rows.filter((r) => r.some((cell) => cell !== ''));
  if (!headerRow) return [];
  const headers = headerRow.map((h) => h.trim());
  return dataRows.map((row) =>
    Object.fromEntries(headers.map((h, idx) => [h, (row[idx] ?? '').trim()])),
  );
}

/**
 * "Bulk import" trigger on the Landing Pages screen. Lets staff drop a CSV
 * whose columns match the landing page's `field_map` source names, parses
 * it client-side, and POSTs the rows to the authenticated bulk endpoint.
 */
export function BulkImportDialog({ landingPage }: { landingPage: LandingPage }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<
    | {
        total: number;
        created: number;
        duplicate: number;
        rejected: number;
        failed: number;
      }
    | null
  >(null);

  // Friendly description of the expected columns: the WordPress source-name
  // side of every entry in field_map (plus 'name' / 'email' / 'phone' default).
  const expected = (() => {
    const map = (landingPage.field_map ?? {}) as Record<string, unknown>;
    const sourceNames = Object.values(map).filter((v): v is string => typeof v === 'string');
    return sourceNames.length > 0 ? sourceNames : ['name', 'email', 'phone'];
  })();

  function reset(): void {
    setFile(null);
    setSummary(null);
    setBusy(false);
  }

  async function onUpload(): Promise<void> {
    if (!file) return;
    setBusy(true);
    setSummary(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error('No rows found in the CSV.');
        setBusy(false);
        return;
      }
      const submissionPrefix = `bulk-${landingPage.id.slice(0, 8)}-${Date.now()}`;
      const payload = {
        rows: rows.map((data, idx) => ({
          submission_id: `${submissionPrefix}-${String(idx).padStart(5, '0')}`,
          source_url: `csv://${file.name}`,
          data,
        })),
      };
      const result = await apiSend<RowResult[]>(
        'POST',
        `landing-pages/${landingPage.id}/bulk-import`,
        payload,
      );
      const totals = result.reduce(
        (acc, r) => {
          acc.total += 1;
          if (r.error) acc.failed += 1;
          else if (r.idempotent) acc.duplicate += 1;
          else if (r.state === 'REJECTED') acc.rejected += 1;
          else acc.created += 1;
          return acc;
        },
        { total: 0, created: 0, duplicate: 0, rejected: 0, failed: 0 },
      );
      setSummary(totals);
      toast.success(
        `Imported ${totals.created} of ${totals.total} (${totals.rejected} rejected, ${totals.duplicate} duplicates)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="size-3.5" />
            Bulk import
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import leads</DialogTitle>
          <DialogDescription>
            Drop a CSV whose header row matches the landing page's field names. Each row runs
            through the same validation pipeline as the webhook (suppression, dedup,
            phone/email format).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expected columns
            </p>
            <p className="mt-1 flex flex-wrap gap-1">
              {expected.map((c) => (
                <code
                  key={c}
                  className="rounded bg-background px-1.5 py-0.5 text-xs text-foreground"
                >
                  {c}
                </code>
              ))}
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
            />
          </label>

          {summary && (
            <div className="rounded-md border border-border bg-card p-3 text-xs">
              <p className="mb-2 inline-flex items-center gap-1 font-medium text-foreground">
                <FileSpreadsheet className="size-3.5" />
                Imported {summary.total} rows
              </p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                <li>
                  <span className="text-muted-foreground">Created</span>{' '}
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {summary.created}
                  </span>
                </li>
                <li>
                  <span className="text-muted-foreground">Rejected</span>{' '}
                  <span className="font-medium text-destructive">{summary.rejected}</span>
                </li>
                <li>
                  <span className="text-muted-foreground">Duplicate</span>{' '}
                  <span className="font-medium">{summary.duplicate}</span>
                </li>
                <li>
                  <span className="text-muted-foreground">Failed</span>{' '}
                  <span className="font-medium text-destructive">{summary.failed}</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={onUpload} disabled={!file || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
