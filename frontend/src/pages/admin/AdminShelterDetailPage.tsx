import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { getShelterOverview, getStaffShelter } from '../../api/shelters';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, ErrorState, KpiCard, PageLoader, RefreshBar, StatusBadge, Tabs, type TabItem } from '../../components/ui';
import { OccupancyBar } from '../../components/OccupancyBar';
import { OccupantsPanel } from '../../features/OccupantsPanel';
import { ResourcesPanel } from '../../features/ResourcesPanel';
import { ShelterForm } from '../../features/ShelterForm';
import { fmtDateTime } from '../../lib/format';

type Tab = 'overview' | 'occupants' | 'resources';

export function AdminShelterDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  const [editing, setEditing] = useState(false);

  const shelter = useLoad(() => getStaffShelter(id), [id]);
  const overview = useLoad(() => getShelterOverview(id), [id]);
  const reloadAll = () => {
    void shelter.reload();
    void overview.reload();
  };

  if (shelter.loading && !shelter.data) return <PageLoader />;
  if (shelter.error || !shelter.data) return <ErrorState message={shelter.error ?? 'Shelter not found'} onRetry={reloadAll} />;
  const s = shelter.data;
  const o = overview.data;

  const tabs: TabItem<Tab>[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'occupants', label: 'Occupants', count: o?.activeOccupants.length },
    { key: 'resources', label: 'Resources', count: o?.resources.filter((r) => r.isActive).length },
  ];

  return (
    <div>
      <Link to="/admin/shelters" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-3">
        <ArrowLeft className="h-4 w-4" /> All shelters
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {s.name} <StatusBadge status={s.status} />
          </h1>
          <p className="text-sm text-gray-500 mt-1">{s.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshBar asOf={overview.data?.asOf ?? overview.loadedAt} onRefresh={reloadAll} loading={overview.loading} />
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(k) => setParams(k === 'overview' ? {} : { tab: k })} />
      <div className="mt-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Occupied" value={`${s.capacityOccupied}/${s.capacityTotal}`} hint={`${s.occupancyPercent}%`} />
              <KpiCard label="Free beds" value={s.availableCapacity} tone="green" />
              <KpiCard label="Pending registrations" value={o?.pendingRegistrations ?? '…'} tone="amber" />
              <KpiCard label="Critical medical" value={o?.medicalCounts.critical ?? '…'} tone="red" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader title="Capacity" />
                <CardBody>
                  <OccupancyBar occupied={s.capacityOccupied} total={s.capacityTotal} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Details" />
                <CardBody>
                  <dl className="grid grid-cols-3 gap-y-2 text-sm">
                    <dt className="text-gray-500">Coordinator</dt>
                    <dd className="col-span-2">{s.coordinator?.name ?? 'Unassigned'}</dd>
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="col-span-2">{s.contactPhone ?? '—'}</dd>
                    <dt className="text-gray-500">Email</dt>
                    <dd className="col-span-2 break-all">{s.contactEmail ?? '—'}</dd>
                    <dt className="text-gray-500">Medical support</dt>
                    <dd className="col-span-2">{s.medicalSupport ? 'Yes' : 'No'}</dd>
                    <dt className="text-gray-500">Languages</dt>
                    <dd className="col-span-2">{['en', ...(s.translations?.map((t) => t.locale) ?? [])].filter((v, i, a) => a.indexOf(v) === i).join(', ')}</dd>
                    <dt className="text-gray-500">Position</dt>
                    <dd className="col-span-2">
                      {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                    </dd>
                  </dl>
                  {s.description && <p className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">{s.description}</p>}
                </CardBody>
              </Card>
            </div>
            {o && (
              <Card>
                <CardHeader title="Resources at a glance" subtitle={`As of ${fmtDateTime(o.asOf)}`} />
                <CardBody className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {o.resources
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <div key={r.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{r.resourceType.toLowerCase()}</span>
                          <StatusBadge status={r.stockStatus} />
                        </div>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                          {r.quantity} <span className="text-xs font-normal text-gray-500">{r.unit}</span>
                        </p>
                      </div>
                    ))}
                </CardBody>
              </Card>
            )}
          </div>
        )}
        {tab === 'occupants' && <OccupantsPanel shelterId={id} />}
        {tab === 'resources' && <ResourcesPanel shelterId={id} />}
      </div>

      <ShelterForm open={editing} shelter={s} onClose={() => setEditing(false)} onSaved={reloadAll} />
    </div>
  );
}
