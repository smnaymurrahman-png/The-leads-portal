'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

import { cn } from '@/lib/utils';

/**
 * Minimal shadcn-style chart wrapper. Wraps Recharts' ResponsiveContainer,
 * publishes per-series CSS color variables (`--color-<seriesKey>`) that
 * recharts can pick up via `stroke="var(--color-revenue)"`, and ships a
 * polished tooltip styled to the popover surface.
 */

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }
>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChartContext() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error('Chart components must be rendered inside <ChartContainer>');
  }
  return ctx;
}

export function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ReactElement;
}) {
  const cssVars = Object.fromEntries(
    Object.entries(config)
      .filter(([, v]) => v.color)
      .map(([key, v]) => [`--color-${key}`, v.color!]),
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
          className,
        )}
        style={cssVars}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

interface TooltipPayloadEntry {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  hideLabel = false,
  className,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  formatter?: (value: number | string, name: string) => React.ReactNode;
  labelFormatter?: (label: string | number) => React.ReactNode;
  hideLabel?: boolean;
  className?: string;
}) {
  const { config } = useChartContext();
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div
      className={cn(
        'min-w-[10rem] rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md',
        className,
      )}
    >
      {!hideLabel && label !== undefined && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? '');
          const seriesLabel = config[key]?.label ?? entry.name ?? key;
          const color = entry.color ?? (config[key]?.color as string | undefined);
          const value =
            formatter && entry.value !== undefined
              ? formatter(entry.value, String(seriesLabel))
              : entry.value;
          return (
            <li key={key} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2">
                {color && (
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-sm"
                    style={{ background: color }}
                  />
                )}
                <span className="text-muted-foreground">{seriesLabel}</span>
              </span>
              <span className="font-medium tabular-nums">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
