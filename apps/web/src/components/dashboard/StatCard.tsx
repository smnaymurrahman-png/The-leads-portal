import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A single KPI tile — large value, label, optional delta + icon. Designed
 * to sit four-across on desktop dashboards.
 */
export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Pre-formatted delta string (e.g. "+12.4%"). Sign drives color + arrow. */
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums leading-none">
            {value}
          </p>
          {hint && <p className="pt-1 text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p
              className={cn(
                'inline-flex items-center gap-1 pt-1 text-xs font-medium',
                trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
                trend.direction === 'down' && 'text-destructive',
                trend.direction === 'flat' && 'text-muted-foreground',
              )}
            >
              {trend.direction === 'up' && <ArrowUpRight className="size-3.5" />}
              {trend.direction === 'down' && <ArrowDownRight className="size-3.5" />}
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground',
              iconClassName,
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
