import { useState } from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { checkInFamily, listCheckins } from '../api/checkins';
import { getShelterOverview } from '../api/shelters';
import { isNetworkError } from '../api/client';
import type { Checkin, ShelterOverview } from '../api/types';
import { useLoad } from '../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, Checkbox, ErrorState, PageLoader, RefreshBar, StatusBadge, Tabs, useToast, type TabItem } from '../components/ui';
import { OccupancyBar } from '../components/OccupancyBar';
import { OccupantForm } from './OccupantForm';
import { OccupantTable } from './OccupantTable';
import { PendingRegistrations } from './PendingRegistrations';
import { setSimulatedOffline, useOfflineQueue } from '../offline/useOffline';
import { loadOverview, saveOverview } from '../offline/overviewCache';
import { fmtAgo, fmtDateTime } from '../lib/format';

type Tab = 'active' | 'checkin' | 'pending' | 'offline';

interface Loaded {
  overview: ShelterOverview;
  /** Set when the data came from the local cache instead of the server. */
  cachedAt: string | null;
}

/** Active occupants / new check-in / pending registrations / offline queue for one shelter. Used by coordinator and admin views. */
export function OccupantsPanel({ shelterId }: { shelterId: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('active');
  const queue = useOfflineQueue(shelterId, (s) => {
    toast[s.failed > 0 ? 'error' : 'success'](`Offline sync: ${s.synced} synced${s.duplicates ? ` (${s.duplicates} already on the server)` : ''}${s.failed ? `, ${s.failed} failed` : ''}`);
    refresh();
  });

  const overview = useLoad<Loaded>(async () => {
    if (queue.offline) {
      const cached = loadOverview(shelterId);
      if (cached) return { overview: cached.overview, cachedAt: cached.savedAt };
      throw new Error('You are offline and no saved data exists for this shelter yet.');
    }
    try {
      const o = await getShelterOverview(shelterId);
      saveOverview(shelterId, o);
      return { overview: o, cachedAt: null };
    } catch (e) {
      const cached = isNetworkError(e) ? loadOverview(shelterId) : null;
      if (cached) return { overview: cached.overview, cachedAt: cached.savedAt };
      throw e;
    }
  }, [shelterId, queue.offline]);
  const pending = useLoad<Checkin[]>(() => (queue.offline ? Promise.resolve([]) : listCheckins(shelterId, { status: 'PENDING' })), [shelterId, queue.offline]);

  const refresh = () => {
    void overview.reload();
    void pending.reload();
  };

  if (overview.loading && !overview.data) return <PageLoader />;
  if (overview.error || !overview.data) {
    return (
      <div className="space-y-3">
        <ErrorState message={overview.error ?? 'Could not load occupants'} onRetry={refresh} />
        {queue.simulated && (
          <Button variant="secondary" onClick={() => setSimulatedOffline(false)}>
            Turn off offline simulation
          </Button>
        )}
      </div>
    );
  }

  const { overview: o, cachedAt } = overview.data;
  const closed = o.shelter.status === 'INACTIVE' || o.shelter.status === 'EMERGENCY_CLOSED';
  const tabs: TabItem<Tab>[] = [
    { key: 'active', label: 'Active occupants', count: o.activeOccupants.length },
    { key: 'checkin', label: 'New check-in' },
    { key: 'pending', label: 'Pending registrations', count: pending.data?.length ?? o.pendingRegistrations },
    { key: 'offline', label: 'Offline queue', count: queue.items.filter((i) => i.status !== 'SYNCED').length || undefined },
  ];

  const submitCheckin = async (data: Parameters<typeof checkInFamily>[1]) => {
    if (queue.offline) {
      queue.enqueue(data);
      toast.info(`${data.personName} saved offline — it will sync when you are back online`);
      setTab('offline');
      return;
    }
    try {
      await checkInFamily(shelterId, data);
      toast.success(`${data.personName} checked in (${data.familySize})`);
      refresh();
      setTab('active');
    } catch (err) {
      if (isNetworkError(err)) {
        queue.enqueue(data);
        toast.info('Connection lost — check-in saved offline and will sync automatically');
        setTab('offline');
        return;
      }
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      {(queue.offline || queue.pending > 0 || queue.failed > 0) && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${queue.offline ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`} role="status">
          <span className="inline-flex items-center gap-2 font-medium">
            {queue.offline ? <WifiOff className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
            {queue.offline ? 'Offline' : 'Online'} · {queue.pending} pending sync{queue.failed > 0 ? ` · ${queue.failed} failed` : ''}
          </span>
          {!queue.offline && queue.pending > 0 && (
            <Button size="sm" variant="secondary" loading={queue.syncing} onClick={() => void queue.syncNow()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Sync now</Button>
          )}
        </div>
      )}
      {cachedAt && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-900">
          Showing saved data from {fmtDateTime(cachedAt)} ({fmtAgo(cachedAt)}). Occupancy may have changed — it refreshes when you are back online.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <OccupancyBar occupied={o.capacity.occupied} total={o.capacity.total} className="w-full sm:w-80" />
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox label="Simulate offline (demo)" checked={queue.simulated} onChange={setSimulatedOffline} />
          <RefreshBar asOf={cachedAt ?? overview.loadedAt} onRefresh={refresh} loading={overview.loading || pending.loading} />
        </div>
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <Card>
        {tab === 'active' && <OccupantTable shelterId={shelterId} occupants={o.activeOccupants} onChanged={refresh} canCheckout={!closed && !queue.offline} />}
        {tab === 'checkin' && (
          <>
            <CardHeader
              title="Check in a family"
              subtitle={queue.offline ? 'You are offline: the check-in is saved on this device and synced later. Capacity is verified by the server at sync time.' : 'Beds are allocated immediately and cannot exceed capacity.'}
            />
            <CardBody>
              {closed ? (
                <ErrorState message="This shelter is closed and cannot accept check-ins." />
              ) : (
                <OccupantForm
                  idPrefix="checkin"
                  allowCritical
                  capacity={{ total: o.capacity.total, occupied: o.capacity.occupied + queue.items.filter((i) => i.status === 'PENDING_SYNC' || i.status === 'SYNCING').reduce((a, i) => a + i.payload.familySize, 0) }}
                  submitLabel={queue.offline ? 'Save offline' : 'Check in family'}
                  onSubmit={submitCheckin}
                />
              )}
            </CardBody>
          </>
        )}
        {tab === 'pending' && (queue.offline ? <CardBody><p className="text-sm text-gray-600">Pending registrations cannot be confirmed while offline.</p></CardBody> : <PendingRegistrations shelterId={shelterId} pending={pending.data ?? []} onChanged={refresh} />)}
        {tab === 'offline' && (
          <>
            <CardHeader
              title="Offline check-in queue"
              subtitle="Stored on this device. Each entry has a unique request id, so a retry can never create a duplicate."
              actions={
                <>
                  {queue.items.some((i) => i.status === 'SYNCED') && <Button size="sm" variant="ghost" onClick={queue.clearSynced}>Clear synced</Button>}
                  <Button size="sm" loading={queue.syncing} disabled={queue.offline || queue.pending === 0} onClick={() => void queue.syncNow()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Sync now</Button>
                </>
              }
            />
            {queue.items.length === 0 ? (
              <CardBody><p className="text-sm text-gray-500">Nothing queued. Check-ins made while offline appear here until they sync.</p></CardBody>
            ) : (
              <ul className="divide-y divide-gray-100">
                {queue.items.map((i) => (
                  <li key={i.clientRequestId} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{i.payload.personName} <span className="text-gray-500 font-normal">· {i.payload.familySize} people</span></p>
                      <p className="text-xs text-gray-500">Queued {fmtAgo(i.createdAt)} · attempts {i.attempts}{i.error ? ` · ${i.error}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {i.status === 'PENDING_SYNC' && <span className="inline-flex rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-medium">Pending sync</span>}
                      {i.status === 'SYNCING' && <span className="inline-flex rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium">Syncing…</span>}
                      {i.status === 'SYNCED' && <StatusBadge status="ACCEPTED" className="" />}
                      {i.status === 'FAILED' && <StatusBadge status="REJECTED" />}
                      {i.status === 'FAILED' && <Button size="sm" variant="secondary" onClick={() => queue.retry(i.clientRequestId)}>Retry</Button>}
                      {(i.status === 'FAILED' || i.status === 'PENDING_SYNC') && <Button size="sm" variant="ghost" onClick={() => queue.discard(i.clientRequestId)}>Discard</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
