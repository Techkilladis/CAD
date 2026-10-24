import { useState } from 'react';
import { Plus } from 'lucide-react';
import { listDonations } from '../../api/donations';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, EmptyState, ErrorState, PageLoader, RefreshBar } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { DonationForm } from '../../features/DonationForm';
import { DonationTable } from '../../features/DonationTable';

export function CoordinatorDonationsPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload, loadedAt } = useLoad(() => listDonations({ shelterId: selectedShelterId! }), [selectedShelterId], { enabled: !!selectedShelterId });
  if (!selectedShelterId || !selectedShelter) return <EmptyState title="No shelter assigned" message="Ask an administrator to assign you a shelter." />;
  return (
    <div>
      <PageHeader
        title="Donations"
        subtitle={`${selectedShelter.name} — record and accept incoming donations`}
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Record donation</Button>
          </>
        }
      />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <Card><DonationTable donations={data} onChanged={reload} /></Card>}
      <DonationForm open={creating} onClose={() => setCreating(false)} onSaved={reload} shelters={[selectedShelter]} defaultShelterId={selectedShelterId} />
    </div>
  );
}
