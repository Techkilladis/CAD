import { PageHeader } from '../../components/PageHeader';
import { ReunificationBoard } from '../../features/ReunificationBoard';

export function CoordinatorReunificationPage() {
  return (
    <div>
      <PageHeader title="Reunification" subtitle="Cases reported by the public. Candidate matches come only from the shelters you manage." />
      <ReunificationBoard />
    </div>
  );
}
