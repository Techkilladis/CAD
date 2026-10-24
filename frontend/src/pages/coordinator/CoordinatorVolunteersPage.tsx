import { useState } from 'react';
import { Plus } from 'lucide-react';
import { listShifts } from '../../api/volunteers';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, EmptyState, ErrorState, PageLoader, RefreshBar } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { ShiftForm } from '../../features/ShiftForm';
import { ShiftTable } from '../../features/ShiftTable';

export function CoordinatorVolunteersPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload, loadedAt } = useLoad(() => listShifts({ shelterId: selectedShelterId! }), [selectedShelterId], { enabled: !!selectedShelterId });
  if (!selectedShelterId) return <EmptyState title="No shelter assigned" message="Ask an administrator to assign you a shelter." />;
  return (
    <div>
      <PageHeader
        title="Volunteers"
        subtitle={`${selectedShelter?.name} — create shifts and see who has signed up`}
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New shift</Button>
          </>
        }
      />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <Card><ShiftTable shifts={data} onChanged={reload} /></Card>}
      <ShiftForm open={creating} shelterId={selectedShelterId} onClose={() => setCreating(false)} onSaved={reload} />
    </div>
  );
}
