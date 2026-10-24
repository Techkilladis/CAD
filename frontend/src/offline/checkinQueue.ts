import type { OccupantInput } from '../api/types';

/**
 * Offline check-in queue. Pure TypeScript with injected storage (localStorage in the app, in-memory in tests)
 * and an injected submitter, so it can be unit tested without a browser or a server.
 *
 * Lifecycle: PENDING_SYNC -> SYNCING -> SYNCED | FAILED(reason)
 *  - Every item carries a clientRequestId. The server treats a repeated id as a replay (HTTP 200 duplicate),
 *    so a retry after a lost response can never create a second check-in.
 *  - A single-flight lock stops two concurrent sync() calls from submitting the same item twice.
 *  - Network failures leave the item PENDING_SYNC (and stop the run); the server saying "no" (e.g. capacity)
 *    marks it FAILED so staff can retry or discard it.
 */

export type QueueStatus = 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface QueueItem {
  clientRequestId: string;
  shelterId: string;
  payload: OccupantInput;
  status: QueueStatus;
  error?: string;
  attempts: number;
  createdAt: string;
  syncedAt?: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Thrown by a submitter. kind: 'network' (never reached the server), 'server' (5xx, retryable), 'rejected' (4xx, will not succeed as-is). */
export class SyncError extends Error {
  kind: 'network' | 'server' | 'rejected';
  constructor(kind: 'network' | 'server' | 'rejected', message: string) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
  }
}

export type Submitter = (shelterId: string, payload: OccupantInput & { clientRequestId: string }) => Promise<{ duplicate: boolean }>;

export interface SyncSummary {
  attempted: number;
  synced: number;
  duplicates: number;
  failed: number;
  stoppedOffline: boolean;
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const defaultId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `cr-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

export class CheckinQueue {
  private inFlight: Promise<SyncSummary> | null = null;
  private listeners = new Set<() => void>();

  private storage: KeyValueStorage;
  private key: string;
  private newId: () => string;
  private now: () => Date;

  constructor(storage: KeyValueStorage, key = 'safehaven.checkinQueue.v1', newId: () => string = defaultId, now: () => Date = () => new Date()) {
    this.storage = storage;
    this.key = key;
    this.newId = newId;
    this.now = now;
  }

  private read(): QueueItem[] {
    try {
      const raw = this.storage.getItem(this.key);
      const parsed = raw ? (JSON.parse(raw) as QueueItem[]) : [];
      // An item left SYNCING by a closed tab was never confirmed: treat it as pending (server de-duplicates by id).
      return parsed.map((i) => (i.status === 'SYNCING' ? { ...i, status: 'PENDING_SYNC' as QueueStatus } : i));
    } catch {
      return [];
    }
  }

  private write(items: QueueItem[]) {
    try {
      this.storage.setItem(this.key, JSON.stringify(items));
    } catch {
      /* storage full/unavailable: queue keeps working in this session only through returned state */
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(shelterId?: string): QueueItem[] {
    return this.read().filter((i) => !shelterId || i.shelterId === shelterId);
  }

  /** Items that still need the server: pending or failed. */
  unsyncedCount(shelterId?: string): number {
    return this.list(shelterId).filter((i) => i.status === 'PENDING_SYNC' || i.status === 'SYNCING').length;
  }

  enqueue(shelterId: string, payload: OccupantInput): QueueItem {
    const item: QueueItem = {
      clientRequestId: this.newId(),
      shelterId,
      payload: { ...payload, clientRequestId: undefined },
      status: 'PENDING_SYNC',
      attempts: 0,
      createdAt: this.now().toISOString(),
    };
    this.write([...this.read(), item]);
    return item;
  }

  private update(id: string, patch: Partial<QueueItem>) {
    this.write(this.read().map((i) => (i.clientRequestId === id ? { ...i, ...patch } : i)));
  }

  /** Moves a FAILED item back to pending so the next sync retries it with the SAME id. */
  retry(id: string) {
    this.update(id, { status: 'PENDING_SYNC', error: undefined });
  }

  discard(id: string) {
    this.write(this.read().filter((i) => i.clientRequestId !== id));
  }

  clearSynced() {
    this.write(this.read().filter((i) => i.status !== 'SYNCED'));
  }

  /** Single-flight: concurrent callers share one run, so no item is submitted twice at once. */
  sync(submit: Submitter, shelterId?: string): Promise<SyncSummary> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run(submit, shelterId).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  get isSyncing() {
    return this.inFlight !== null;
  }

  private async run(submit: Submitter, shelterId?: string): Promise<SyncSummary> {
    const summary: SyncSummary = { attempted: 0, synced: 0, duplicates: 0, failed: 0, stoppedOffline: false };
    const todo = this.list(shelterId).filter((i) => i.status === 'PENDING_SYNC');
    for (const item of todo) {
      summary.attempted++;
      this.update(item.clientRequestId, { status: 'SYNCING', attempts: item.attempts + 1 });
      try {
        const res = await submit(item.shelterId, { ...item.payload, clientRequestId: item.clientRequestId });
        if (res.duplicate) summary.duplicates++;
        summary.synced++;
        this.update(item.clientRequestId, { status: 'SYNCED', syncedAt: this.now().toISOString(), error: undefined });
      } catch (e) {
        const kind = e instanceof SyncError ? e.kind : 'network';
        const message = e instanceof Error ? e.message : 'Sync failed';
        if (kind === 'rejected') {
          summary.failed++;
          this.update(item.clientRequestId, { status: 'FAILED', error: message });
        } else {
          // network / server error: leave it pending and stop, the rest would fail the same way
          this.update(item.clientRequestId, { status: 'PENDING_SYNC', error: message });
          summary.stoppedOffline = true;
          break;
        }
      }
    }
    return summary;
  }
}
