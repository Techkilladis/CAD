import { listAlerts } from '../../api/alerts';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Card, EmptyState, ErrorState, PageLoader, RefreshBar } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { AlertList } from '../../features/AlertList';

export function CoordinatorAlertsPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  const { data, loading, error, reload, loadedAt } = useLoad(() => listAlerts({ shelterId: selectedShelterId! }), [selectedShelterId], { enabled: !!selectedShelterId });
  if (!selectedShelterId) return <EmptyState title="No shelter assigned" message="Ask an administrator to assign you a shelter." />;
  return (
    <div>
      <PageHeader title="Alerts" subtitle={selectedShelter?.name} actions={<RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <Card>
          <AlertList alerts={data} onChanged={reload} />
        </Card>
      )}
    </div>
  );
}
