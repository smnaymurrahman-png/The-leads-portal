import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Generic table skeleton — header strip + a stack of row strips. Sits inside
 * a Card with `p-0` to match the live tables on every list screen.
 */
export function TableSkeleton({
  columns = 5,
  rows = 6,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('p-6', className)}>
      <div className="flex gap-3 border-b border-border pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="space-y-3 pt-4">
        {Array.from({ length: rows }).map((_, r) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={r} className="flex items-center gap-3">
            {Array.from({ length: columns }).map((_, c) => (
              // eslint-disable-next-line react/no-array-index-key
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stat-card grid skeleton — N tiles sized to match StatCard. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2',
        count >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="size-10 rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

/** Chart card skeleton matching RevenueTrendCard's silhouette. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-[260px] w-full" />
      </CardContent>
    </Card>
  );
}
