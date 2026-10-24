import { Link } from 'react-router-dom';
import { Bell, Boxes, HeartPulse, Hourglass, Users, BedDouble } from 'lucide-react';
import { getShelterOverview } from '../../api/shelters';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, KpiCard, PageLoader, RefreshBar, StatusBadge } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { OccupancyBar } from '../../components/OccupancyBar';
import { fmtAgo, RESOURCE_LABEL } from '../../lib/format';

export function CoordinatorOverviewPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  const { data: o, loading, error, reload, loadedAt } = useLoad(() => getShelterOverview(selectedShelterId!), [selectedShelterId], { enabled: !!selectedShelterId });

  if (!selectedShelterId) return <EmptyState title="No shelter assigned" message="Ask an administrator to assign you a shelter." />;
  if (loading && !o) return <PageLoader />;
  if (error || !o) return <ErrorState message={error ?? 'Could not load overview'} onRetry={reload} />;

  const lowStock = o.resources.filter((r) => r.isActive && r.stockStatus !== 'HEALTHY');
  const mc = o.medicalCounts;

  return (
    <div>
      <PageHeader
        title={selectedShelter?.name ?? o.shelter.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={o.shelter.status} /> {o.shelter.address}
          </span>
        }
        actions={<RefreshBar asOf={o.asOf ?? loadedAt} onRefresh={reload} loading={loading} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Occupied" value={`${o.capacity.occupied}/${o.capacity.total}`} hint={`${o.capacity.percent}%`} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Free beds" value={o.capacity.available} tone="green" icon={<BedDouble className="h-5 w-5" />} />
        <KpiCard label="Pending registrations" value={o.pendingRegistrations} tone="amber" icon={<Hourglass className="h-5 w-5" />} />
        <KpiCard label="Critical medical" value={mc.critical} hint={`${mc.high} high priority`} tone="red" icon={<HeartPulse className="h-5 w-5" />} />
        <KpiCard label="Low-stock items" value={lowStock.length} tone={lowStock.length ? 'amber' : 'green'} icon={<Boxes className="h-5 w-5" />} />
        <KpiCard label="Active alerts" value={o.alerts.length} tone={o.alerts.length ? 'red' : 'green'} icon={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Occupancy" actions={<Link to="/coordinator/occupants" className="text-sm text-blue-600 hover:underline">Manage occupants</Link>} />
          <CardBody>
            <OccupancyBar occupied={o.capacity.occupied} total={o.capacity.total} />
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Children</dt>
              <dd className="font-medium">{mc.children}</dd>
              <dt className="text-gray-500">Elderly</dt>
              <dd className="font-medium">{mc.elderly}</dd>
              <dt className="text-gray-500">Pregnant</dt>
              <dd className="font-medium">{mc.pregnant}</dd>
              <dt className="text-gray-500">Disability</dt>
              <dd className="font-medium">{mc.disabled}</dd>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stock" actions={<Link to="/coordinator/resources" className="text-sm text-blue-600 hover:underline">Update stock</Link>} />
          <CardBody className="space-y-2">
            {o.resources.filter((r) => r.isActive).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{RESOURCE_LABEL[r.resourceType]}</span>
                <span className="flex items-center gap-3">
                  <span className="text-gray-600">
                    {r.quantity.toLocaleString('en-IN')} {r.unit}
                  </span>
                  <StatusBadge status={r.stockStatus} />
                </span>
              </div>
            ))}
            {o.resources.length === 0 && <p className="text-sm text-gray-500">No resources tracked yet.</p>}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Active alerts" subtitle="Generated automatically from occupancy, stock and medical needs" />
          {o.alerts.length === 0 ? (
            <EmptyState title="No active alerts" message="Everything is within thresholds." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {o.alerts.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-900">{a.message}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.alertType.replace(/_/g, ' ').toLowerCase()} · {fmtAgo(a.triggeredAt)}
                    </p>
                  </div>
                  <StatusBadge status={a.severity} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
