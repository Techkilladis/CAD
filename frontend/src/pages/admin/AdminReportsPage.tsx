import { useState } from 'react';
import { listManagedShelters } from '../../api/shelters';
import { useLoad } from '../../hooks/useLoad';
import { Select } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { ReportsView } from '../../features/ReportsView';

export function AdminReportsPage() {
  const [shelterId, setShelterId] = useState('');
  const shelters = useLoad(listManagedShelters, []);
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="District-wide metrics. Pick a shelter to narrow every chart."
        actions={
          <div className="w-60">
            <Select label="Shelter" value={shelterId} onChange={(e) => setShelterId(e.target.value)}>
              <option value="">Whole district</option>
              {(shelters.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </Select>
          </div>
        }
      />
      <ReportsView shelterId={shelterId || undefined} />
    </div>
  );
}
