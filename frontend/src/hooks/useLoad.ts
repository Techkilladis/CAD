import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';

export interface LoadState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  loadedAt: Date | null;
  reload: () => Promise<void>;
}

/**
 * Loads data on mount and whenever `deps` change; `reload()` refetches (Refresh buttons, post-mutation refresh).
 * Optional polling re-runs the loader every `pollMs` (no fake real-time: callers label data "as of").
 */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[], opts: { pollMs?: number; enabled?: boolean } = {}): LoadState<T> {
  const { pollMs, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const run = useCallback(async (silent: boolean) => {
    const mine = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const result = await loaderRef.current();
      if (mine !== seq.current) return; // stale response
      setData(result);
      setError(null);
      setLoadedAt(new Date());
    } catch (e) {
      if (mine !== seq.current) return;
      setError(getErrorMessage(e, 'Failed to load data'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    if (!enabled || !pollMs) return;
    const id = window.setInterval(() => void run(true), pollMs);
    return () => window.clearInterval(id);
  }, [enabled, pollMs, run]);

  const reload = useCallback(() => run(false), [run]);
  return { data, loading, error, loadedAt, reload };
}
