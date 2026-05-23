'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from './proxy-client';

/**
 * Loads a list resource through the API proxy. Pass `null` as the path to
 * skip fetching entirely (e.g. a sub-resource the current role cannot read).
 */
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (path === null) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<T[]>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
