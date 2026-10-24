import { describe, expect, it } from 'vitest';
import { CheckinQueue, MemoryStorage, SyncError, type Submitter } from './checkinQueue';

const person = { personName: 'Queued Family', familySize: 3 };
let n = 0;
const makeQueue = (storage = new MemoryStorage()) => new CheckinQueue(storage, 'q', () => `req-${++n}-xxxxxxxx`);

/** Fake server: tracks which ids it has seen so replays behave like the real idempotent endpoint. */
function fakeServer(opts: { capacity?: number } = {}) {
  const seen = new Map<string, number>();
  let occupied = 0;
  const submit: Submitter = async (_shelter, p) => {
    if (seen.has(p.clientRequestId)) return { duplicate: true };
    if (opts.capacity !== undefined && occupied + p.familySize > opts.capacity) throw new SyncError('rejected', 'Insufficient capacity');
    occupied += p.familySize;
    seen.set(p.clientRequestId, p.familySize);
    return { duplicate: false };
  };
  return { submit, seen, occupied: () => occupied };
}

describe('CheckinQueue', () => {
  it('enqueue stores a PENDING_SYNC item with a unique clientRequestId and persists it', () => {
    const storage = new MemoryStorage();
    const q = makeQueue(storage);
    const a = q.enqueue('s1', person);
    const b = q.enqueue('s1', person);
    expect(a.status).toBe('PENDING_SYNC');
    expect(a.clientRequestId).not.toBe(b.clientRequestId);
    expect(q.unsyncedCount('s1')).toBe(2);
    // a fresh queue over the same storage sees the same items (survives a reload)
    expect(makeQueue(storage).list()).toHaveLength(2);
  });

  it('sync submits each pending item with its id and marks it SYNCED', async () => {
    const q = makeQueue();
    const server = fakeServer();
    q.enqueue('s1', person);
    q.enqueue('s1', { ...person, familySize: 2 });
    const summary = await q.sync(server.submit);
    expect(summary).toMatchObject({ attempted: 2, synced: 2, failed: 0, stoppedOffline: false });
    expect(q.list().every((i) => i.status === 'SYNCED' && i.syncedAt)).toBe(true);
    expect(server.occupied()).toBe(5);
    expect(q.unsyncedCount()).toBe(0);
  });

  it('marks server rejections FAILED with the reason and keeps syncing later items', async () => {
    const q = makeQueue();
    const server = fakeServer({ capacity: 4 });
    const big = q.enqueue('s1', { ...person, familySize: 10 });
    q.enqueue('s1', { ...person, familySize: 2 });
    const summary = await q.sync(server.submit);
    expect(summary).toMatchObject({ attempted: 2, synced: 1, failed: 1 });
    const failed = q.list().find((i) => i.clientRequestId === big.clientRequestId)!;
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toBe('Insufficient capacity');
    expect(server.occupied()).toBe(2);
  });

  it('a network failure leaves items pending and stops the run (no FAILED, no data loss)', async () => {
    const q = makeQueue();
    q.enqueue('s1', person);
    q.enqueue('s1', person);
    const offline: Submitter = async () => {
      throw new SyncError('network', 'Cannot reach the server');
    };
    const summary = await q.sync(offline);
    expect(summary).toMatchObject({ attempted: 1, synced: 0, stoppedOffline: true });
    expect(q.list().map((i) => i.status)).toEqual(['PENDING_SYNC', 'PENDING_SYNC']);
    expect(q.list()[0].attempts).toBe(1);

    const server = fakeServer();
    const again = await q.sync(server.submit);
    expect(again.synced).toBe(2);
  });

  it('single-flight: concurrent sync calls share one run and submit each item once', async () => {
    const q = makeQueue();
    q.enqueue('s1', person);
    let calls = 0;
    const slow: Submitter = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { duplicate: false };
    };
    const [a, b, c] = await Promise.all([q.sync(slow), q.sync(slow), q.sync(slow)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(q.isSyncing).toBe(false);
  });

  it('idempotent replay: syncing the same item again after a lost response creates no second check-in', async () => {
    const q = makeQueue();
    const server = fakeServer();
    const item = q.enqueue('s1', person);
    // first attempt: the server accepts but the response is lost (network error on the client)
    const flaky: Submitter = async (s, p) => {
      await server.submit(s, p);
      throw new SyncError('network', 'response lost');
    };
    await q.sync(flaky);
    expect(q.list()[0].status).toBe('PENDING_SYNC');
    // second attempt reuses the SAME clientRequestId, so the server reports a duplicate
    const summary = await q.sync(server.submit);
    expect(summary).toMatchObject({ synced: 1, duplicates: 1 });
    expect(server.seen.size).toBe(1);
    expect(server.occupied()).toBe(3);
    expect(q.list()[0].clientRequestId).toBe(item.clientRequestId);
  });

  it('retry moves a FAILED item back to pending with the same id; discard removes it', async () => {
    const q = makeQueue();
    const item = q.enqueue('s1', { ...person, familySize: 9 });
    await q.sync(fakeServer({ capacity: 4 }).submit);
    expect(q.list()[0].status).toBe('FAILED');
    q.retry(item.clientRequestId);
    expect(q.list()[0]).toMatchObject({ status: 'PENDING_SYNC', clientRequestId: item.clientRequestId });
    await q.sync(fakeServer({ capacity: 4 }).submit);
    expect(q.list()[0].status).toBe('FAILED');
    q.discard(item.clientRequestId);
    expect(q.list()).toHaveLength(0);
  });

  it('only syncs the requested shelter, and a SYNCING item left by a closed tab is treated as pending', async () => {
    const storage = new MemoryStorage();
    const q = makeQueue(storage);
    q.enqueue('s1', person);
    const other = q.enqueue('s2', person);
    const server = fakeServer();
    await q.sync(server.submit, 's1');
    expect(q.list('s2')[0].status).toBe('PENDING_SYNC');
    storage.setItem('q', JSON.stringify(q.list().map((i) => (i.clientRequestId === other.clientRequestId ? { ...i, status: 'SYNCING' } : i))));
    expect(makeQueue(storage).list('s2')[0].status).toBe('PENDING_SYNC');
  });

  it('notifies subscribers on every change and clearSynced prunes finished items', async () => {
    const q = makeQueue();
    let changes = 0;
    const off = q.subscribe(() => changes++);
    q.enqueue('s1', person);
    await q.sync(fakeServer().submit);
    expect(changes).toBeGreaterThanOrEqual(3);
    q.clearSynced();
    expect(q.list()).toHaveLength(0);
    off();
    const before = changes;
    q.enqueue('s1', person);
    expect(changes).toBe(before);
  });
});
