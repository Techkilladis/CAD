import { useState } from 'react';
import { checkInFamily, listCheckins } from '../api/checkins';
import { getShelterOverview } from '../api/shelters';
import type { Checkin } from '../api/types';
import { useLoad } from '../hooks/useLoad';
import { Card, CardBody, CardHeader, ErrorState, PageLoader, RefreshBar, Tabs, useToast, type TabItem } from '../components/ui';
import { OccupancyBar } from '../components/OccupancyBar';
import { OccupantForm } from './OccupantForm';
import { OccupantTable } from './OccupantTable';
import { PendingRegistrations } from './PendingRegistrations';

type Tab = 'active' | 'checkin' | 'pending';

/** Active occupants / new check-in / pending public registrations for one shelter. Used by coordinator and admin views. */
export function OccupantsPanel({ shelterId }: { shelterId: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('active');

  const overview = useLoad(() => getShelterOverview(shelterId), [shelterId]);
  const pending = useLoad<Checkin[]>(() => listCheckins(shelterId, { status: 'PENDING' }), [shelterId]);

  const refresh = () => {
    void overview.reload();
    void pending.reload();
  };

  if (overview.loading && !overview.data) return <PageLoader />;
  if (overview.error || !overview.data) return <ErrorState message={overview.error ?? 'Could not load occupants'} onRetry={refresh} />;

  const o = overview.data;
  const tabs: TabItem<Tab>[] = [
    { key: 'active', label: 'Active occupants', count: o.activeOccupants.length },
    { key: 'checkin', label: 'New check-in' },
    { key: 'pending', label: 'Pending registrations', count: pending.data?.length ?? o.pendingRegistrations },
  ];

  const closed = o.shelter.status === 'INACTIVE' || o.shelter.status === 'EMERGENCY_CLOSED';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <OccupancyBar occupied={o.capacity.occupied} total={o.capacity.total} className="w-full sm:w-80" />
        <RefreshBar asOf={overview.loadedAt} onRefresh={refresh} loading={overview.loading || pending.loading} />
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <Card>
        {tab === 'active' && <OccupantTable shelterId={shelterId} occupants={o.activeOccupants} onChanged={refresh} canCheckout={!closed} />}
        {tab === 'checkin' && (
          <>
            <CardHeader title="Check in a family" subtitle="Beds are allocated immediately and cannot exceed capacity." />
            <CardBody>
              {closed ? (
                <ErrorState message="This shelter is closed and cannot accept check-ins." />
              ) : (
                <OccupantForm
                  idPrefix="checkin"
                  allowCritical
                  capacity={{ total: o.capacity.total, occupied: o.capacity.occupied }}
                  submitLabel="Check in family"
                  onSubmit={async (data) => {
                    await checkInFamily(shelterId, data);
                    toast.success(`${data.personName} checked in (${data.familySize})`);
                    refresh();
                    setTab('active');
                  }}
                />
              )}
            </CardBody>
          </>
        )}
        {tab === 'pending' && (
          <PendingRegistrations shelterId={shelterId} pending={pending.data ?? []} onChanged={refresh} />
        )}
      </Card>
    </div>
  );
}
