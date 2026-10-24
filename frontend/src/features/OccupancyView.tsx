import { Link } from 'react-router-dom';
import { Building2, Gauge, TriangleAlert, Users } from 'lucide-react';
import type { DistrictOccupancy, DistrictShelter } from '../api/types';
import { Card, CardBody, CardHeader, DataTable, EmptyState, KpiCard, StatusBadge, type Column } from '../components/ui';
import { OccupancyBar } from '../components/OccupancyBar';
import { ShelterMap } from './ShelterMap';

export function OccupancyKpis({ totals }: { totals: DistrictOccupancy['totals'] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Operational shelters" value={`${totals.operationalShelters}/${totals.shelters}`} icon={<Building2 className="h-5 w-5" />} />
      <KpiCard label="Occupied / capacity" value={`${totals.totalOccupied}/${totals.totalCapacity}`} hint={`${totals.occupancyPercent}% of operational beds`} icon={<Users className="h-5 w-5" />} tone="purple" />
      <KpiCard label="Beds available" value={totals.totalAvailable} icon={<Gauge className="h-5 w-5" />} tone="green" />
      <KpiCard label="Critical / full" value={`${totals.criticalShelters} / ${totals.fullShelters}`} hint="90%+ occupancy / no beds" icon={<TriangleAlert className="h-5 w-5" />} tone="red" />
    </div>
  );
}

function ShelterList({ title, rows, base, empty }: { title: string; rows: DistrictShelter[]; base: string; empty: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((s) => (
            <li key={s.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Link to={`${base}/${s.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                  {s.name}
                </Link>
                <StatusBadge status={s.classification} />
              </div>
              <OccupancyBar occupied={s.capacityOccupied} total={s.capacityTotal} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** District occupancy: map + per-shelter bars + critical / full lists. `detailBase` is where shelter links go. */
export function OccupancyView({ data, detailBase, showTable = true }: { data: DistrictOccupancy; detailBase: string; showTable?: boolean }) {
  const columns: Column<DistrictShelter>[] = [
    { key: 'name', header: 'Shelter', sortValue: (s) => s.name, render: (s) => <Link to={`${detailBase}/${s.id}`} className="font-medium text-gray-900 hover:text-blue-600">{s.name}</Link> },
    { key: 'occ', header: 'Occupied', sortValue: (s) => s.capacityOccupied, render: (s) => `${s.capacityOccupied}/${s.capacityTotal}` },
    { key: 'free', header: 'Free beds', sortValue: (s) => s.available, render: (s) => s.available },
    { key: 'bar', header: 'Occupancy', sortValue: (s) => s.occupancyPercent, className: 'min-w-40', render: (s) => <OccupancyBar occupied={s.capacityOccupied} total={s.capacityTotal} showLabel={false} /> },
    { key: 'pct', header: '%', sortValue: (s) => s.occupancyPercent, render: (s) => `${s.occupancyPercent}%` },
    { key: 'status', header: 'Status', sortValue: (s) => s.classification, render: (s) => <StatusBadge status={s.classification} /> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ShelterMap shelters={data.shelters} height={380} detailBase={detailBase} />
        </div>
        <div className="space-y-6">
          <ShelterList title="Critical (90%+)" rows={data.critical} base={detailBase} empty="No shelters near capacity" />
          <ShelterList title="Full shelters" rows={data.full} base={detailBase} empty="No full shelters" />
        </div>
      </div>
      {showTable && (
        <Card>
          <CardHeader title="All shelters" subtitle="Inactive and closed shelters are excluded from district totals." />
          <CardBody className="!p-0">
            <DataTable columns={columns} rows={data.shelters} rowKey={(s) => s.id} initialSort={{ key: 'pct', dir: 'desc' }} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
