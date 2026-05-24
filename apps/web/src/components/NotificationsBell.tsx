'use client';

import Link from 'next/link';
import { Bell, CreditCard, ShoppingCart, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from './NotificationsProvider';
import { cn } from '@/lib/utils';

const ICON = {
  lead: Zap,
  payment: CreditCard,
  order: ShoppingCart,
} as const;

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Header bell. Shows a red dot + count badge when there's unread activity. */
export function NotificationsBell() {
  const { notifications, unreadCount, markAllRead, clearAll, status } = useNotifications();

  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Notifications"
            className="relative"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-medium uppercase',
              status === 'live' && 'text-emerald-700 dark:text-emerald-400',
              status === 'offline' && 'text-destructive',
            )}
          >
            {status}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No activity yet — order events and delivered leads will show up here.
          </div>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const Icon = ICON[n.kind];
                const body = (
                  <div className="flex items-start gap-2 px-2 py-1.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      {n.description && (
                        <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                      )}
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {relative(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <DropdownMenuItem key={n.id} className="p-0">
                    {n.href ? (
                      <Link href={n.href} className="w-full">
                        {body}
                      </Link>
                    ) : (
                      <div className="w-full">{body}</div>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearAll}>
              <Trash2 className="size-3.5" />
              Clear all
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
