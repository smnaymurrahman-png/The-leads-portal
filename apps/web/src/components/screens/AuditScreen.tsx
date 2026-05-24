'use client';

import { useEffect, useMemo, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useResource } from '@/lib/use-resource';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
  actor: { full_name: string; role: string } | null;
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  SUPER_ADMIN: 'default',
  ADMIN: 'secondary',
  AGENT: 'outline',
  CLIENT: 'outline',
};

/**
 * Quick relative-time formatter — "12s ago", "5m ago", "3h ago", "2d ago".
 * Anything past 14 days falls back to the locale date.
 */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** SUPER_ADMIN audit viewer — every sensitive action, newest first, filterable. */
export function AuditScreen() {
  const { data, loading, error } = useResource<AuditRow>('audit');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Tick the "now" clock so relative timestamps stay fresh while the page is open.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter(
      (row) =>
        row.action.toLowerCase().includes(q) ||
        row.entity.toLowerCase().includes(q) ||
        (row.entity_id?.toLowerCase().includes(q) ?? false) ||
        (row.actor?.full_name.toLowerCase().includes(q) ?? false),
    );
  }, [data, query]);

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin"
        title="Audit log"
        description="Every order decision, manual assignment, refund, replacement review and policy change."
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by actor, entity, action…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72 pl-8"
            />
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-12 text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="px-6 py-12 text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <ScrollText className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No matching entries</p>
              <p className="text-xs text-muted-foreground">
                {query
                  ? 'Try a different search, or clear the filter.'
                  : 'Audited actions will appear here as they happen.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell
                      className="text-xs text-muted-foreground"
                      title={new Date(row.created_at).toLocaleString()}
                      // `now` is read so React re-renders this cell on each tick.
                      data-now={now}
                    >
                      {relativeTime(row.created_at)}
                    </TableCell>
                    <TableCell>
                      {row.actor ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.actor.full_name}</span>
                          <Badge variant={ROLE_VARIANT[row.actor.role] ?? 'outline'}>
                            {row.actor.role.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">system</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.entity}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {row.entity_id ?? '—'}
                      </code>
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
