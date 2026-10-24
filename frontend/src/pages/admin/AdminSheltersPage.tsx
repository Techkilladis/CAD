import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Power } from 'lucide-react';
import { listManagedShelters, setShelterStatus } from '../../api/shelters';
import { getErrorMessage } from '../../api/client';
import type { StaffShelter } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, ConfirmDialog, DataTable, ErrorState, PageLoader, RefreshBar, SearchInput, StatusBadge, useToast, type Column } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { OccupancyBar } from '../../components/OccupancyBar';
import { ShelterForm } from '../../features/ShelterForm';

export function AdminSheltersPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload, loadedAt } = useLoad(listManagedShelters, []);
  const [q, setQ] = useState('');
  const [formFor, setFormFor] = useState<StaffShelter | 'new' | null>(null);
  const [toggle, setToggle] = useState<StaffShelter | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = (data ?? []).filter((s) => !q || `${s.name} ${s.address}`.toLowerCase().includes(q.toLowerCase()));

  const doToggle = async () => {
    if (!toggle) return;
    const next = toggle.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    setBusy(true);
    try {
      await setShelterStatus(toggle.id, next);
      toast.success(`${toggle.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      setToggle(null);
      void reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change shelter status'));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<StaffShelter>[] = [
    {
      key: 'name',
      header: 'Shelter',
      sortValue: (s) => s.name.toLowerCase(),
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.name}</p>
          <p className="text-xs text-gray-500">{s.address}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, render: (s) => <StatusBadge status={s.status} /> },
    { key: 'occ', header: 'Occupancy', sortValue: (s) => s.occupancyPercent, className: 'min-w-44', render: (s) => <OccupancyBar occupied={s.capacityOccupied} total={s.capacityTotal} /> },
    { key: 'coord', header: 'Coordinator', sortValue: (s) => s.coordinator?.name ?? '', render: (s) => s.coordinator?.name ?? <span className="text-gray-400">Unassigned</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setFormFor(s)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" icon={<Power className="h-3.5 w-3.5" />} onClick={() => setToggle(s)}>
            {s.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shelters"
        subtitle="Create, edit and activate shelters. Nothing is ever hard-deleted."
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormFor('new')}>
              New shelter
            </Button>
          </>
        }
      />
      <div className="mb-4 max-w-sm">
        <SearchInput value={q} onChange={setQ} placeholder="Search shelters" />
      </div>
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <Card>
          <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/admin/shelters/${s.id}`)} emptyTitle="No shelters found" />
        </Card>
      )}
      <ShelterForm open={formFor !== null} shelter={formFor === 'new' ? null : formFor} onClose={() => setFormFor(null)} onSaved={() => void reload()} />
      <ConfirmDialog
        open={!!toggle}
        title={toggle?.status === 'INACTIVE' ? 'Activate shelter?' : 'Deactivate shelter?'}
        danger={toggle?.status !== 'INACTIVE'}
        confirmLabel={toggle?.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
        loading={busy}
        onCancel={() => setToggle(null)}
        onConfirm={doToggle}
        message={
          toggle?.status === 'INACTIVE' ? (
            <>
              <strong>{toggle?.name}</strong> will become visible to the public and can accept check-ins.
            </>
          ) : (
            <>
              <strong>{toggle?.name}</strong> will be hidden from the public finder and stop accepting check-ins. Existing records are kept
              {toggle && toggle.capacityOccupied > 0 ? ` (${toggle.capacityOccupied} people are currently recorded as occupants — check them out or transfer them first)` : ''}.
            </>
          )
        }
      />
    </div>
  );
}
