'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiSend } from '@/lib/proxy-client';

/**
 * Shared list-screen mutation toolkit: selection state, edit state,
 * single + bulk delete with FK-friendly error reporting, and an optional
 * `setStatus` helper for entities that have a status field.
 *
 * The caller passes the resource name (e.g. `'users'`) used to build proxy
 * URLs and a `reload` callback to refresh the underlying list after writes.
 */
export function useEntityActions<T extends { id: string }>(
  resource: string,
  reload: () => Promise<void> | void,
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<T | null>(null);
  const [deletingOne, setDeletingOne] = useState<T | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<'delete' | 'activate' | 'deactivate' | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectionHelpers = useMemo(
    () => ({
      isSelected: (id: string) => selected.has(id),
      toggleOne: (id: string) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      toggleAll: (rows: T[], checked: boolean) =>
        setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set()),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );

  async function setStatus(ids: string[], status: string, verb: string): Promise<void> {
    setPending(true);
    try {
      await Promise.all(ids.map((id) => apiSend('PATCH', `${resource}/${id}`, { status })));
      await reload();
      setSelected(new Set());
      toast.success(`${ids.length === 1 ? '1 entry' : `${ids.length} entries`} ${verb}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  async function deleteIds(ids: string[]): Promise<void> {
    setPending(true);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/proxy/${resource}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Delete failed (${res.status})`);
        }
      }),
    );
    setPending(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    await reload();
    setSelected(new Set());
    if (fail === 0) toast.success(`${ok} deleted`);
    else if (ok === 0) {
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      toast.error(first.reason instanceof Error ? first.reason.message : 'Delete failed');
    } else toast.warning(`${ok} deleted, ${fail} failed (likely referenced elsewhere)`);
  }

  return {
    // Selection
    selected,
    selectedIds,
    ...selectionHelpers,
    // Edit
    editing,
    setEditing,
    // Delete
    deletingOne,
    setDeletingOne,
    bulkConfirm,
    setBulkConfirm,
    // Mutations
    pending,
    setStatus,
    deleteIds,
  };
}
