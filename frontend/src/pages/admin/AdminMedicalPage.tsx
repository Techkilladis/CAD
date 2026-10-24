import { getMedicalSummary } from '../../api/dashboard';
import type { MedicalSummary } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Card, CardHeader, DataTable, ErrorState, PageLoader, RefreshBar, StatusBadge, type Column } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { MedicalKpis, MedicalPriorityList } from '../../features/MedicalPriorityList';

type Row = MedicalSummary['perShelter'][number];

export function AdminMedicalPage() {
  const { data, loading, error, reload, loadedAt } = useLoad(() => getMedicalSummary(), []);
  const cols: Column<Row>[] = [
    { key: 'name', header: 'Shelter', sortValue: (r) => r.name, render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'med', header: 'Medical support', render: (r) => (r.medicalSupport ? 'Yes' : <span className="text-red-600">No</span>) },
    { key: 'crit', header: 'Critical', sortValue: (r) => r.counts.critical, render: (r) => r.counts.critical },
    { key: 'high', header: 'High', sortValue: (r) => r.counts.high, render: (r) => r.counts.high },
    { key: 'med2', header: 'Medium', sortValue: (r) => r.counts.medium, render: (r) => r.counts.medium },
    { key: 'low', header: 'Low', sortValue: (r) => r.counts.low, render: (r) => r.counts.low },
    { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <div>
      <PageHeader title="Medical priorities" subtitle="District-wide cases, highest priority first. Confidential — staff only." actions={<RefreshBar asOf={data?.asOf ?? loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <MedicalKpis totals={data.totals} />
          <Card><CardHeader title="By shelter" subtitle="Shelters with critical cases but no medical support need attention" /><DataTable columns={cols} rows={data.perShelter} rowKey={(r) => r.id} initialSort={{ key: 'crit', dir: 'desc' }} /></Card>
          <Card><CardHeader title="Cases" /><MedicalPriorityList cases={data.cases} showShelter /></Card>
        </div>
      )}
    </div>
  );
}
