import { getReports } from '../api/admin';
import type { ReportsPayload, ResourceType } from '../api/types';
import { RESOURCE_TYPES } from '../api/types';
import { useLoad } from '../hooks/useLoad';
import { Card, CardBody, CardHeader, ErrorState, KpiCard, PageLoader, RefreshBar } from '../components/ui';
import { BarChart, Donut, StackedBar, type Datum } from '../components/charts';
import { RESOURCE_LABEL } from '../lib/format';
import { OccupancyKpis } from './OccupancyView';

const TRANSFER_COLOR: Record<string, string> = { PENDING: '#f59e0b', APPROVED: '#2563eb', IN_TRANSIT: '#7c3aed', RECEIVED: '#16a34a', REJECTED: '#dc2626', CANCELLED: '#94a3b8' };

/** Charts for every reporting metric. `shelterId` (optional) narrows to one shelter; the server also auto-scopes coordinators. */
export function ReportsView({ shelterId }: { shelterId?: string }) {
  const { data, loading, error, reload, loadedAt } = useLoad<ReportsPayload>(() => getReports(shelterId), [shelterId]);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load reports'} onRetry={reload} />;
  const d = data;

  const occupancy: Datum[] = d.occupancy.shelters.map((s) => ({ label: s.name, value: s.occupancyPercent, color: s.occupancyPercent >= 100 ? '#dc2626' : s.occupancyPercent >= 90 ? '#f59e0b' : '#16a34a' }));
  const stockStatus = (t: ResourceType) => {
    const row = d.resources.types.find((x) => x.resourceType === t);
    const cells = row?.shelters ?? [];
    const n = (s: string) => cells.filter((c) => c.stockStatus === s).length;
    return [
      { label: 'Healthy', value: n('HEALTHY'), color: '#16a34a' },
      { label: 'Low', value: n('LOW'), color: '#f59e0b' },
      { label: 'Critical', value: n('CRITICAL'), color: '#dc2626' },
      { label: 'Empty', value: n('EMPTY'), color: '#7f1d1d' },
    ];
  };
  const donationByType: Datum[] = RESOURCE_TYPES.map((t) => ({ label: RESOURCE_LABEL[t], value: d.donations.filter((x) => x.resourceType === t && x.status === 'ACCEPTED').reduce((a, x) => a + x.quantity, 0) }));
  const donationStatus = (['ACCEPTED', 'PENDING', 'REJECTED'] as const).map((s, i) => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: d.donations.filter((x) => x.status === s).reduce((a, x) => a + x.count, 0), color: ['#16a34a', '#f59e0b', '#dc2626'][i] }));
  const mt = d.medical.totals;
  const alertsActive = d.alerts.filter((a) => a.status !== 'RESOLVED');
  const alertTypes = Array.from(new Set(d.alerts.map((a) => a.alertType))).map((t) => ({ label: t.replace(/_/g, ' ').toLowerCase(), value: alertsActive.filter((a) => a.alertType === t).reduce((x, a) => x + a.count, 0) }));
  const confirmed = d.checkins.find((c) => c.status === 'CONFIRMED');

  return (
    <div className="space-y-6">
      <RefreshBar asOf={d.asOf ?? loadedAt} onRefresh={reload} loading={loading} />
      <OccupancyKpis totals={d.occupancy.totals} />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Occupancy by shelter" subtitle="% of beds in use" />
          <CardBody><BarChart data={occupancy} unit="%" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="People sheltered" />
          <CardBody>
            <Donut centerLabel="people" segments={d.checkins.filter((c) => ['CONFIRMED', 'CHECKED_OUT', 'PENDING'].includes(c.status)).map((c) => ({ label: c.status === 'CONFIRMED' ? 'Currently sheltered' : c.status === 'CHECKED_OUT' ? 'Checked out' : 'Registered, not arrived', value: c.people, color: c.status === 'CONFIRMED' ? '#2563eb' : c.status === 'CHECKED_OUT' ? '#94a3b8' : '#f59e0b' }))} />
            {confirmed && <p className="mt-3 text-xs text-gray-500">{confirmed.count} families currently checked in.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Resource stock status" subtitle="Number of shelters in each state, per resource" />
        <CardBody className="grid md:grid-cols-2 gap-x-8 gap-y-5">
          {RESOURCE_TYPES.map((t) => (
            <div key={t}>
              <p className="text-sm font-medium text-gray-800 mb-1.5">{RESOURCE_LABEL[t]} <span className="text-gray-500 font-normal">· {(d.resources.types.find((x) => x.resourceType === t)?.total ?? 0).toLocaleString('en-IN')} {d.resources.types.find((x) => x.resourceType === t)?.unit ?? ''} district total</span></p>
              <StackedBar segments={stockStatus(t)} />
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Medical priorities" subtitle="Occupants currently sheltered" />
          <CardBody>
            <BarChart data={[
              { label: 'Critical', value: mt.critical, color: '#dc2626' },
              { label: 'High', value: mt.high, color: '#f97316' },
              { label: 'Medium', value: mt.medium, color: '#f59e0b' },
              { label: 'Low', value: mt.low, color: '#2563eb' },
              { label: 'Pregnant', value: mt.pregnant, color: '#7c3aed' },
              { label: 'Disability', value: mt.disabled, color: '#0891b2' },
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Transfers by status" />
          <CardBody>
            <StackedBar segments={['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'].map((s) => ({ label: s.replace('_', ' ').toLowerCase(), value: d.transfersByStatus.find((t) => t.status === s)?.count ?? 0, color: TRANSFER_COLOR[s] }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Active alerts by type" />
          <CardBody><BarChart data={alertTypes} emptyText="No alerts recorded yet" /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Volunteer coverage" subtitle="Upcoming open shifts" />
          <CardBody>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <KpiCard label="Coverage" value={d.volunteers.totals.coveragePercent === null ? '—' : `${d.volunteers.totals.coveragePercent}%`} tone="green" />
              <KpiCard label="Filled" value={`${d.volunteers.totals.filled}/${d.volunteers.totals.required}`} />
              <KpiCard label="Unfilled" value={d.volunteers.totals.unfilled} tone={d.volunteers.totals.unfilled > 0 ? 'amber' : 'green'} />
            </div>
            <BarChart data={d.volunteers.perShelter.filter((s) => s.coveragePercent !== null).map((s) => ({ label: s.shelterName, value: s.coveragePercent ?? 0 }))} unit="%" emptyText="No upcoming shifts" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Donations received" subtitle="Accepted quantity by resource" />
          <CardBody><BarChart data={donationByType} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Donation status" />
          <CardBody><Donut segments={donationStatus} centerLabel="donations" /></CardBody>
        </Card>
        {d.reunification && (
          <Card className="lg:col-span-2">
            <CardHeader title="Reunification cases" />
            <CardBody>
              <StackedBar segments={(['MISSING', 'POTENTIAL_MATCH', 'REUNITED', 'CLOSED'] as const).map((s, i) => ({ label: s.replace('_', ' ').toLowerCase(), value: d.reunification!.find((r) => r.status === s)?.count ?? 0, color: ['#dc2626', '#f59e0b', '#16a34a', '#94a3b8'][i] }))} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
