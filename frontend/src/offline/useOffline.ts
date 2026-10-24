import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { checkInFamily } from '../api/checkins';
import { getErrorMessage, isNetworkError } from '../api/client';
import axios from 'axios';
import { CheckinQueue, SyncError, type QueueItem, type Submitter, type SyncSummary } from './checkinQueue';

// One queue per browser profile, backed by localStorage (falls back to memory if storage is blocked).
const storage = (() => {
  try {
    const k = '__sh_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  }
})();
export const checkinQueue = new CheckinQueue(storage);

/** Adapter between the pure queue and the real API: classifies errors for the queue. */
export const submitCheckin: Submitter = async (shelterId, payload) => {
  try {
    const res = await checkInFamily(shelterId, payload);
    return { duplicate: 'duplicate' in res };
  } catch (e) {
    if (isNetworkError(e)) throw new SyncError('network', 'Cannot reach the server');
    const status = axios.isAxiosError(e) ? e.response?.status ?? 0 : 0;
    throw new SyncError(status >= 500 ? 'server' : 'rejected', getErrorMessage(e, 'Server rejected this check-in'));
  }
};

// ---- Demo "simulate offline" switch (so the flow can be shown without DevTools) ----
const SIM_KEY = 'safehaven.simulateOffline';
const simListeners = new Set<() => void>();
const readSim = () => {
  try {
    return localStorage.getItem(SIM_KEY) === '1';
  } catch {
    return false;
  }
};
let simValue = readSim();
export function setSimulatedOffline(v: boolean) {
  simValue = v;
  try {
    localStorage.setItem(SIM_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
  simListeners.forEach((l) => l());
}

function useSimulated() {
  return useSyncExternalStore(
    (cb) => {
      simListeners.add(cb);
      return () => simListeners.delete(cb);
    },
    () => simValue
  );
}

function useBrowserOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Queue state for one shelter plus connectivity. Triggers a sync on mount, on the browser `online` event and when simulation is switched off. */
export function useOfflineQueue(shelterId: string, onSynced?: (s: SyncSummary) => void) {
  const browserOnline = useBrowserOnline();
  const simulated = useSimulated();
  const offline = !browserOnline || simulated;
  const items = useSyncExternalStore(
    (cb) => checkinQueue.subscribe(cb),
    () => storage.getItem('safehaven.checkinQueue.v1') ?? ''
  );
  const [syncing, setSyncing] = useState(false);
  const [list, setList] = useState<QueueItem[]>(() => checkinQueue.list(shelterId));

  useEffect(() => {
    setList(checkinQueue.list(shelterId));
  }, [items, shelterId]);

  const syncNow = useCallback(async () => {
    if (offline) return null;
    setSyncing(true);
    try {
      const s = await checkinQueue.sync(submitCheckin, shelterId);
      if (s.attempted > 0) onSynced?.(s);
      return s;
    } finally {
      setSyncing(false);
    }
  }, [offline, shelterId, onSynced]);

  // Auto-sync whenever we are (back) online with something pending: mount, online event, simulation off.
  useEffect(() => {
    if (!offline && checkinQueue.unsyncedCount(shelterId) > 0) void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, shelterId]);

  return {
    offline,
    simulated,
    items: list,
    pending: list.filter((i) => i.status === 'PENDING_SYNC' || i.status === 'SYNCING').length,
    failed: list.filter((i) => i.status === 'FAILED').length,
    syncing,
    syncNow,
    enqueue: (payload: Parameters<CheckinQueue['enqueue']>[1]) => checkinQueue.enqueue(shelterId, payload),
    retry: (id: string) => checkinQueue.retry(id),
    discard: (id: string) => checkinQueue.discard(id),
    clearSynced: () => checkinQueue.clearSynced(),
  };
}
