import { listResources } from '../api/resources';
import type { Resource } from '../api/types';
import { useLoad } from '../hooks/useLoad';
import { Card, ErrorState, PageLoader, RefreshBar } from '../components/ui';
import { ResourceTable } from './ResourceTable';

/** Loads and edits one shelter's resources (staff view). */
export function ResourcesPanel({ shelterId }: { shelterId: string }) {
  const { data, loading, error, reload, loadedAt } = useLoad(() => listResources(shelterId) as Promise<Resource[]>, [shelterId]);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load resources'} onRetry={reload} />;
  return (
    <div className="space-y-3">
      <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
      <Card>
        <ResourceTable shelterId={shelterId} resources={data} onChanged={reload} />
      </Card>
    </div>
  );
}
