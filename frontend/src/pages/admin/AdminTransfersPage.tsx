import { useState } from 'react';
import { Plus } from 'lucide-react';
import { listTransfers } from '../../api/transfers';
import type { Transfer, TransferStatus } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, ErrorState, PageLoader, RefreshBar, Tabs, type TabItem } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { TransferForm } from '../../features/TransferForm';
import { TransferTable } from '../../features/TransferTable';

type Tab = 'ALL' | TransferStatus;
const ORDER: TransferStatus[] = ['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'];
const LABEL: Record<TransferStatus, string> = { PENDING: 'Pending', APPROVED: 'Approved', IN_TRANSIT: 'In transit', RECEIVED: 'Received', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };

export function AdminTransfersPage() {
  const { data, loading, error, reload, loadedAt } = useLoad<Transfer[]>(() => listTransfers(), []);
  const [tab, setTab] = useState<Tab>('PENDING');
  const [creating, setCreating] = useState(false);

  const all = data ?? [];
  const tabs: TabItem<Tab>[] = [
    ...ORDER.map((s) => ({ key: s as Tab, label: LABEL[s], count: all.filter((t) => t.status === s).length })),
    { key: 'ALL', label: 'All', count: all.length },
  ];
  const rows = tab === 'ALL' ? all : all.filter((t) => t.status === tab);

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Approve requests, track dispatch and receipt. Stock moves on approval (source) and on receipt (destination)."
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New transfer</Button>
          </>
        }
      />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
          <Card className="mt-4">
            <TransferTable transfers={rows} onChanged={reload} emptyMessage="Nothing in this state." />
          </Card>
        </>
      )}
      <TransferForm open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </div>
  );
}
