import { useState } from 'react';
import { Plus } from 'lucide-react';
import { listDonations } from '../../api/donations';
import { listManagedShelters } from '../../api/shelters';
import type { DonationStatus, ResourceType } from '../../api/types';
import { RESOURCE_TYPES } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, ErrorState, KpiCard, PageLoader, RefreshBar, Select } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { DonationForm } from '../../features/DonationForm';
import { DonationTable } from '../../features/DonationTable';
import { RESOURCE_LABEL } from '../../lib/format';

export function AdminDonationsPage() {
  const [shelterId, setShelterId] = useState('');
  const [type, setType] = useState<ResourceType | ''>('');
  const [status, setStatus] = useState<DonationStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const shelters = useLoad(listManagedShelters, []);
  const { data, loading, error, reload, loadedAt } = useLoad(
    () => listDonations({ shelterId: shelterId || undefined, resourceType: type || undefined, status: status || undefined }),
    [shelterId, type, status]
  );

  const accepted = (data ?? []).filter((d) => d.status === 'ACCEPTED');
  const byType = RESOURCE_TYPES.map((t) => ({ t, qty: accepted.filter((d) => d.resourceType === t).reduce((a, d) => a + d.quantity, 0), unit: accepted.find((d) => d.resourceType === t)?.unit ?? '' }));

  return (
    <div>
      <PageHeader
        title="Donations"
        subtitle="Donation register and report across shelters"
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Record donation</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-56"><Select label="Shelter" value={shelterId} onChange={(e) => setShelterId(e.target.value)}><option value="">All shelters</option>{(shelters.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</Select></div>
        <div className="w-44"><Select label="Resource" value={type} onChange={(e) => setType(e.target.value as ResourceType | '')}><option value="">All</option>{RESOURCE_TYPES.map((t) => (<option key={t} value={t}>{RESOURCE_LABEL[t]}</option>))}</Select></div>
        <div className="w-44"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as DonationStatus | '')}><option value="">All</option><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option></Select></div>
      </div>
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard label="Donations (filtered)" value={data.length} />
            {byType.map((b) => (<KpiCard key={b.t} label={`${RESOURCE_LABEL[b.t]} accepted`} value={b.qty.toLocaleString('en-IN')} hint={b.unit} tone="green" />))}
          </div>
          <Card>
            <CardHeader title="Donation register" subtitle={`${data.filter((d) => d.status === 'PENDING').length} pending acceptance`} />
            <CardBody className="!p-0"><DonationTable donations={data} onChanged={reload} showShelter /></CardBody>
          </Card>
        </div>
      )}
      <DonationForm open={creating} onClose={() => setCreating(false)} onSaved={reload} shelters={shelters.data ?? []} />
    </div>
  );
}
