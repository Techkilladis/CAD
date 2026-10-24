import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { ReportsView } from '../../features/ReportsView';

export function CoordinatorReportsPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  if (!selectedShelterId) return <EmptyState title="No shelter assigned" />;
  return (
    <div>
      <PageHeader title="Reports" subtitle={selectedShelter?.name} />
      <ReportsView key={selectedShelterId} shelterId={selectedShelterId} />
    </div>
  );
}
