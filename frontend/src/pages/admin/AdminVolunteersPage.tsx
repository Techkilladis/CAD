import { useState } from 'react';
import { Plus } from 'lucide-react';
import { listShifts, listVolunteers } from '../../api/volunteers';
import { listManagedShelters } from '../../api/shelters';
import type { Shift } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardHeader, DataTable, ErrorState, KpiCard, PageLoader, RefreshBar, Select, type Column } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { ShiftForm } from '../../features/ShiftForm';
import { ShiftTable } from '../../features/ShiftTable';

export function AdminVolunteersPage() {
  const shifts = useLoad<Shift[]>(() => listShifts(), []);
  const shelters = useLoad(listManagedShelters, []);
  const volunteers = useLoad(listVolunteers, []);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => new Date());

  const open = (shifts.data ?? []).filter((s) => s.status === 'OPEN' && new Date(s.endTime) >= now);
  const rows = (shifts.data ?? []).filter((s) => !filter || s.shelterId === filter);
  const needed = open.reduce((a, s) => a + s.requiredCount, 0);
  const filled = open.reduce((a, s) => a + s.filledCount, 0);

  const coverage = (shelters.data ?? []).map((sh) => {
    const mine = open.filter((s) => s.shelterId === sh.id);
    const req = mine.reduce((a, s) => a + s.requiredCount, 0);
    const fil = mine.reduce((a, s) => a + s.filledCount, 0);
    return { id: sh.id, name: sh.name, shifts: mine.length, required: req, filled: fil };
  });
  const coverageCols: Column<(typeof coverage)[number]>[] = [
    { key: 'name', header: 'Shelter', sortValue: (c) => c.name, render: (c) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'shifts', header: 'Open shifts', sortValue: (c) => c.shifts, render: (c) => c.shifts },
    { key: 'cov', header: 'Coverage', sortValue: (c) => (c.required ? c.filled / c.required : 1), render: (c) => (c.required ? `${c.filled}/${c.required} (${Math.round((c.filled / c.required) * 100)}%)` : '—') },
  ];

  const reload = () => { void shifts.reload(); void volunteers.reload(); };

  return (
    <div>
      <PageHeader
        title="Volunteers"
        subtitle="District-wide shifts and coverage"
        actions={
          <>
            <RefreshBar asOf={shifts.loadedAt} onRefresh={reload} loading={shifts.loading} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New shift</Button>
          </>
        }
      />
      {shifts.loading && !shifts.data && <PageLoader />}
      {shifts.error && <ErrorState message={shifts.error} onRetry={reload} />}
      {shifts.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Registered volunteers" value={volunteers.data?.length ?? '…'} />
            <KpiCard label="Upcoming open shifts" value={open.length} tone="purple" />
            <KpiCard label="Slots filled" value={`${filled}/${needed}`} tone="green" />
            <KpiCard label="Unfilled slots" value={Math.max(0, needed - filled)} tone={needed - filled > 0 ? 'amber' : 'green'} />
          </div>
          <Card>
            <CardHeader title="Coverage by shelter" subtitle="Upcoming open shifts only" />
            <DataTable columns={coverageCols} rows={coverage} rowKey={(c) => c.id} pageSize={8} />
          </Card>
          <Card>
            <CardHeader title="All shifts" actions={
              <div className="w-56"><Select label="Shelter" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">All shelters</option>
                {(shelters.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </Select></div>} />
            <ShiftTable shifts={rows} onChanged={reload} showShelter />
          </Card>
        </div>
      )}
      <ShiftForm open={creating} shelterOptions={shelters.data ?? []} onClose={() => setCreating(false)} onSaved={reload} />
    </div>
  );
}
