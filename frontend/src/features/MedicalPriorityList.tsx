import { useState } from 'react';
import type { MedicalCase, MedicalPriority, PriorityCounts } from '../api/types';
import { DataTable, KpiCard, Select, StatusBadge, type Column } from '../components/ui';
import { fmtAgo, PRIORITY_RANK } from '../lib/format';

export function MedicalKpis({ totals }: { totals: PriorityCounts }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      <KpiCard label="Critical" value={totals.critical} tone="red" />
      <KpiCard label="High" value={totals.high} tone="amber" />
      <KpiCard label="Medium" value={totals.medium} tone="amber" />
      <KpiCard label="Low" value={totals.low} tone="blue" />
      <KpiCard label="Pregnant" value={totals.pregnant} tone="purple" />
      <KpiCard label="Disability" value={totals.disabled} tone="purple" />
      <KpiCard label="Elderly" value={totals.elderly} tone="gray" />
      <KpiCard label="Children" value={totals.children} tone="gray" />
    </div>
  );
}

/** Priority-ordered list of occupants with medical or special needs. Staff views only. */
export function MedicalPriorityList({ cases, showShelter }: { cases: (MedicalCase | (MedicalCase & { shelterName?: string }))[]; showShelter?: boolean }) {
  const [filter, setFilter] = useState<MedicalPriority | ''>('');
  const rows = cases.filter((c) => !filter || c.priority === filter);
  const columns: Column<MedicalCase>[] = [
    { key: 'priority', header: 'Priority', sortValue: (c) => PRIORITY_RANK[c.priority], render: (c) => <StatusBadge status={c.priority} context="priority" /> },
    {
      key: 'name',
      header: 'Family',
      sortValue: (c) => c.personName.toLowerCase(),
      render: (c) => (
        <div>
          <p className="font-medium text-gray-900">{c.personName}</p>
          {showShelter && <p className="text-xs text-gray-500">{c.shelterName}</p>}
          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
        </div>
      ),
    },
    { key: 'size', header: 'Size', sortValue: (c) => c.familySize, render: (c) => c.familySize },
    {
      key: 'needs',
      header: 'Needs',
      render: (c) => (
        <span className="text-xs text-gray-700">
          {[c.criticalMedical && 'critical case', c.medicalFlag && 'medical', c.pregnantFlag && 'pregnant', c.disabledFlag && 'disability', c.elderlyCount > 0 && `${c.elderlyCount} elderly`, c.childrenCount > 0 && `${c.childrenCount} children`].filter(Boolean).join(', ')}
        </span>
      ),
    },
    { key: 'notes', header: 'Notes', render: (c) => <span className="text-xs text-gray-600">{c.medicalNotes || c.emergencyNotes || '—'}</span> },
    { key: 'in', header: 'Arrived', sortValue: (c) => c.checkedInAt, render: (c) => <span className="text-xs text-gray-500">{fmtAgo(c.checkedInAt)}</span> },
  ];
  return (
    <div>
      <div className="p-4 border-b border-gray-100 w-56">
        <Select label="Priority" value={filter} onChange={(e) => setFilter(e.target.value as MedicalPriority | '')}>
          <option value="">All</option>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as MedicalPriority[]).map((p) => (<option key={p} value={p}>{p.toLowerCase()}</option>))}
        </Select>
      </div>
      <DataTable columns={columns} rows={rows as MedicalCase[]} rowKey={(c) => c.id} initialSort={{ key: 'priority', dir: 'desc' }} emptyTitle="No cases" emptyMessage="No occupants with medical or special needs match." />
    </div>
  );
}
