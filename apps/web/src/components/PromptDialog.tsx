'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Imperative "ask for a note, then confirm" Dialog — replaces window.prompt.
 *
 * Usage:
 *   const [prompt, mount] = usePromptDialog();
 *   const note = await prompt({ title: '…', label: '…' });
 *   if (note) await reject(id, note);
 *   // somewhere in your JSX: {mount}
 */
export function usePromptDialog() {
  const [state, setState] = useState<PromptState | null>(null);

  function ask(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      setState({
        options,
        resolve: (value) => {
          setState(null);
          resolve(value);
        },
      });
    });
  }

  const mount = state ? <PromptDialog key={state.options.title} {...state} /> : null;

  return [ask, mount] as const;
}

interface PromptOptions {
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
  defaultValue?: string;
}

interface PromptState {
  options: PromptOptions;
  resolve: (value: string | null) => void;
}

function PromptDialog({ options, resolve }: PromptState) {
  const [value, setValue] = useState(options.defaultValue ?? '');
  const [saving, setSaving] = useState(false);

  function onCancel(open: boolean): void {
    if (!open) resolve(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    resolve(trimmed);
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium">
            {options.label}
            <textarea
              autoFocus
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={options.placeholder}
              className="mt-1.5 min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <DialogFooter showCloseButton>
            <Button
              type="submit"
              variant={options.destructive ? 'destructive' : 'default'}
              disabled={saving || value.trim().length === 0}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {options.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
