'use client';

import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

/**
 * App-wide toast surface. Reads our shadcn tokens so the toasts match
 * Card/Popover styling in both themes. Mounted once in the root layout.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      theme="light"
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-border bg-popover text-popover-foreground shadow-md',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
