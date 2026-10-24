import { useState } from 'react';
import { Plus } from 'lucide-react';
import { listTransfers } from '../../api/transfers';
import type { Transfer, TransferStatus } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, EmptyState, ErrorState, PageLoader, RefreshBar, Select, Tabs, type TabItem } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { TransferForm } from '../../features/TransferForm';
import { TransferTable } from '../../features/TransferTable';

type Dir = 'outgoing' | 'incoming';

export function CoordinatorTransfersPage() {
  const { selectedShelterId, selectedShelter } = useAuth();
  const [dir, setDir] = useState<Dir>('incoming');
  const [status, setStatus] = useState<TransferStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const { data, loading, error, reload, loadedAt } = useLoad<Transfer[]>(
    () => listTransfers({ shelterId: selectedShelterId!, direction: dir }),
    [selectedShelterId, dir],
    { enabled: !!selectedShelterId }
  );

  if (!selectedShelterId) return <EmptyState title="No shelter assigned" message="Ask an administrator to assign you a shelter." />;

  const tabs: TabItem<Dir>[] = [
    { key: 'incoming', label: 'Incoming (to my shelter)' },
    { key: 'outgoing', label: 'Outgoing (from my shelter)' },
  ];
  const rows = (data ?? []).filter((t) => !status || t.status === status);

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle={`${selectedShelter?.name} — request stock from, or send stock to, another shelter`}
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New request</Button>
          </>
        }
      />
      <Tabs tabs={tabs} active={dir} onChange={setDir} />
      <div className="my-4 w-52">
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as TransferStatus | '')}>
          <option value="">All</option>
          {(['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'] as TransferStatus[]).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>
          ))}
        </Select>
      </div>
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <Card>
          <TransferTable transfers={rows} onChanged={reload} emptyMessage={dir === 'incoming' ? 'No transfers are heading to your shelter.' : 'You have not sent any transfers.'} />
        </Card>
      )}
      <TransferForm key={selectedShelterId} open={creating} onClose={() => setCreating(false)} onCreated={reload} ownShelterId={selectedShelterId} />
    </div>
  );
}
