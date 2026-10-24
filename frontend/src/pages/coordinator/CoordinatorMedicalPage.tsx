import { getMedicalSummary } from '../../api/dashboard';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Card, EmptyState, ErrorState, PageLoader, RefreshBar } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { MedicalKpis, MedicalPriorityList } from '../../features/MedicalPriorityList';

export function CoordinatorMedicalPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  const { data, loading, error, reload, loadedAt } = useLoad(() => getMedicalSummary(selectedShelterId!), [selectedShelterId], { enabled: !!selectedShelterId });
  if (!selectedShelterId) return <EmptyState title="No shelter assigned" />;
  return (
    <div>
      <PageHeader title="Medical priorities" subtitle={`${selectedShelter?.name} — confidential: visible to shelter staff only`} actions={<RefreshBar asOf={data?.asOf ?? loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <MedicalKpis totals={data.totals} />
          <Card><MedicalPriorityList cases={data.cases} /></Card>
        </div>
      )}
    </div>
  );
}
