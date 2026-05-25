'use client';

import { PauseCircle, PlayCircle, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Sticky banner that appears above a list when one or more rows are checked.
 * The caller supplies a `count` (rendered as `N selected`) and optional
 * handlers for each bulk action; only buttons whose handler is provided are
 * shown.
 */
export function BulkActionsBar({
  count,
  onClear,
  onActivate,
  onDeactivate,
  onDelete,
  pending,
}: {
  count: number;
  onClear: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  pending?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
      <span className="font-medium text-foreground">
        {count} selected
      </span>
      <span className="flex-1" />
      {onActivate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onActivate}
          disabled={pending}
        >
          <PlayCircle className="size-3.5" />
          Activate
        </Button>
      )}
      {onDeactivate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDeactivate}
          disabled={pending}
        >
          <PauseCircle className="size-3.5" />
          Deactivate
        </Button>
      )}
      {onDelete && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label="Clear selection"
        disabled={pending}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
