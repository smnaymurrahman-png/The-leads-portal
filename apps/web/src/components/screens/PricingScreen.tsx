'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { apiGet, apiSend } from '@/lib/proxy-client';

const LEAD_TYPES = ['SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER'] as const;
const MODES = ['EXCLUSIVE', 'SHARED'] as const;

interface Price {
  lead_type: string;
  delivery_mode: string;
  unit_price: number;
}

const keyOf = (type: string, mode: string): string => `${type}:${mode}`;

/** Lead pricing grid — editable, SUPER_ADMIN only. */
export function PricingScreen() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiGet<Price[]>('pricing/leads');
        const map: Record<string, number> = {};
        for (const type of LEAD_TYPES) {
          for (const mode of MODES) {
            map[keyOf(type, mode)] = 0;
          }
        }
        for (const price of list) {
          map[keyOf(price.lead_type, price.delivery_mode)] = price.unit_price;
        }
        setPrices(map);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load prices');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setPrice(type: string, mode: string, value: string): void {
    setPrices((prev) => ({ ...prev, [keyOf(type, mode)]: Number(value) || 0 }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      await apiSend('PUT', 'pricing/leads', {
        prices: LEAD_TYPES.flatMap((type) =>
          MODES.map((mode) => ({
            lead_type: type,
            delivery_mode: mode,
            unit_price: prices[keyOf(type, mode)] ?? 0,
          })),
        ),
      });
      toast.success('Prices updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save prices');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pricing"
        title="Lead pricing"
        description="Unit price (USD) per lead type and delivery mode. Editable by SUPER_ADMIN."
      />

      <Card>
        <CardHeader>
          <CardTitle>Price grid</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5 text-left font-medium">Lead type</th>
                      {MODES.map((mode) => (
                        <th key={mode} className="px-3 py-2.5 text-left font-medium">
                          {mode.toLowerCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LEAD_TYPES.map((type) => (
                      <tr key={type} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-3 font-medium capitalize">
                          {type.toLowerCase()}
                        </td>
                        {MODES.map((mode) => (
                          <td key={mode} className="px-3 py-3">
                            <div className="relative w-32">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                $
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={prices[keyOf(type, mode)] ?? 0}
                                onChange={(e) => setPrice(type, mode, e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-2 text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 border-t border-border pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {saving ? 'Saving…' : 'Save prices'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
