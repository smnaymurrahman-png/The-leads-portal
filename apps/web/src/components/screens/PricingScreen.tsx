'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Button, Panel } from '@/components/ui';
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        setError(e instanceof Error ? e.message : 'Failed to load prices');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setPrice(type: string, mode: string, value: string): void {
    setPrices((prev) => ({ ...prev, [keyOf(type, mode)]: Number(value) || 0 }));
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = {
        prices: LEAD_TYPES.flatMap((type) =>
          MODES.map((mode) => ({
            lead_type: type,
            delivery_mode: mode,
            unit_price: prices[keyOf(type, mode)] ?? 0,
          })),
        ),
      };
      await apiSend('PUT', 'pricing/leads', payload);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save prices');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Lead Pricing</h1>
        <p className="text-sm text-slate-500">
          Unit price (USD) per lead type and delivery mode. Editable by SUPER_ADMIN.
        </p>
      </header>

      <Panel title="Price grid">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <table className="text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1 text-left">Lead type</th>
                  {MODES.map((mode) => (
                    <th key={mode} className="px-2 py-1 text-left">
                      {mode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEAD_TYPES.map((type) => (
                  <tr key={type}>
                    <td className="px-2 py-1.5 text-slate-300">{type}</td>
                    {MODES.map((mode) => (
                      <td key={mode} className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={prices[keyOf(type, mode)] ?? 0}
                          onChange={(e) => setPrice(type, mode, e.target.value)}
                          className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 outline-none focus:border-blue-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save prices'}
              </Button>
              {saved && <span className="text-sm text-emerald-400">Saved.</span>}
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
