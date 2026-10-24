import { getDistrict } from '../../api/dashboard';
import { useLoad } from '../../hooks/useLoad';
import { ErrorState, PageLoader, RefreshBar } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { OccupancyKpis, OccupancyView } from '../../features/OccupancyView';

export function AdminOccupancyPage() {
  const { data, loading, error, reload, loadedAt } = useLoad(() => getDistrict(), []);
  return (
    <div>
      <PageHeader title="Occupancy" subtitle="District totals, per-shelter occupancy and shelters needing attention" actions={<RefreshBar asOf={data?.asOf ?? loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <OccupancyKpis totals={data.totals} />
          <OccupancyView data={data} detailBase="/admin/shelters" />
        </div>
      )}
    </div>
  );
}
