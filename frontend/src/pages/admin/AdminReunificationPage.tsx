import { PageHeader } from '../../components/PageHeader';
import { ReunificationBoard } from '../../features/ReunificationBoard';

export function AdminReunificationPage() {
  return (
    <div>
      <PageHeader title="Reunification" subtitle="Missing-person cases reported by the public. Candidate occupants are matched by name across all shelters." />
      <ReunificationBoard />
    </div>
  );
}
