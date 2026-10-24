import { getDistrict } from '../../api/dashboard';
import { useLoad } from '../../hooks/useLoad';
import { ErrorState, PageLoader, RefreshBar } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { OccupancyKpis, OccupancyView } from '../../features/OccupancyView';

export function AdminOverviewPage() {
  const { data, loading, error, reload, loadedAt } = useLoad(() => getDistrict(), []);
  return (
    <div>
      <PageHeader title="District overview" subtitle="Shelter occupancy across the district" actions={<RefreshBar asOf={data?.asOf ?? loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <OccupancyKpis totals={data.totals} />
          <OccupancyView data={data} detailBase="/admin/shelters" showTable={false} />
        </div>
      )}
    </div>
  );
}
