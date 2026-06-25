'use client';

import { Edit3, KeyRound, MoreHorizontal, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Per-row dropdown menu used across every list screen. Edit always shows;
 * Activate / Deactivate only appears when the entity has a status; Delete
 * is always shown last and styled as destructive.
 */
export function RowActions({
  onEdit,
  onDelete,
  status,
  onActivate,
  onDeactivate,
  onResetPassword,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  /** Current account status — controls which toggle item is shown. */
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE' | null;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onResetPassword?: () => void;
  disabled?: boolean;
}) {
  const showActivate = onActivate && status && status !== 'ACTIVE';
  const showDeactivate = onDeactivate && status === 'ACTIVE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Row actions"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>
          <Edit3 className="size-3.5" />
          Edit
        </DropdownMenuItem>
        {onResetPassword && (
          <DropdownMenuItem onClick={onResetPassword}>
            <KeyRound className="size-3.5" />
            Reset password
          </DropdownMenuItem>
        )}
        {showActivate && (
          <DropdownMenuItem onClick={onActivate}>
            <PlayCircle className="size-3.5" />
            Activate
          </DropdownMenuItem>
        )}
        {showDeactivate && (
          <DropdownMenuItem onClick={onDeactivate}>
            <PauseCircle className="size-3.5" />
            Deactivate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
