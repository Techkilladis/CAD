import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { OccupantsPanel } from '../../features/OccupantsPanel';

export function CoordinatorOccupantsPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  if (!selectedShelterId) return <EmptyState title="No shelter assigned" message="Ask an administrator to assign you a shelter." />;
  return (
    <div>
      <PageHeader title="Occupants" subtitle={selectedShelter?.name} />
      <OccupantsPanel key={selectedShelterId} shelterId={selectedShelterId} />
    </div>
  );
}
