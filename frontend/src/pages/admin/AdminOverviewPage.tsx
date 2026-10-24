import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanSearch } from 'lucide-react';
import { getDistrict } from '../../api/dashboard';
import { listAlerts, runAlertCheck } from '../../api/alerts';
import { listTransfers } from '../../api/transfers';
import { getErrorMessage } from '../../api/client';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardHeader, ErrorState, PageLoader, RefreshBar, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { OccupancyKpis, OccupancyView } from '../../features/OccupancyView';
import { AlertList } from '../../features/AlertList';
import { TransferTable } from '../../features/TransferTable';

export function AdminOverviewPage() {
  const toast = useToast();
  const district = useLoad(() => getDistrict(), []);
  const alerts = useLoad(() => listAlerts({ status: 'ACTIVE' }), []);
  const pending = useLoad(() => listTransfers({ status: 'PENDING' }), []);
  const [scanning, setScanning] = useState(false);

  const reloadAll = () => {
    void district.reload();
    void alerts.reload();
    void pending.reload();
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await runAlertCheck();
      toast.success(`Scanned ${r.scanned} shelters: ${r.created} new alert(s), ${r.resolved} resolved`);
      reloadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Alert check failed'));
    } finally {
      setScanning(false);
    }
  };

  const data = district.data;
  return (
    <div>
      <PageHeader
        title="District overview"
        subtitle="Shelter occupancy across the district"
        actions={
          <>
            <RefreshBar asOf={data?.asOf ?? district.loadedAt} onRefresh={reloadAll} loading={district.loading} />
            <Button icon={<ScanSearch className="h-4 w-4" />} onClick={scan} loading={scanning}>Run alert check</Button>
          </>
        }
      />
      {district.loading && !data && <PageLoader />}
      {district.error && <ErrorState message={district.error} onRetry={reloadAll} />}
      {data && (
        <div className="space-y-6">
          <OccupancyKpis totals={data.totals} />
          <OccupancyView data={data} detailBase="/admin/shelters" showTable={false} />
          <div className="grid xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Top active alerts" actions={<Link to="/admin/alerts" className="text-sm text-blue-600 hover:underline">All alerts</Link>} />
              <AlertList alerts={(alerts.data ?? []).slice(0, 6)} onChanged={reloadAll} shelterLink={(id) => `/admin/shelters/${id}`} showFilters={false} compact />
            </Card>
            <Card>
              <CardHeader title="Transfers awaiting approval" actions={<Link to="/admin/transfers" className="text-sm text-blue-600 hover:underline">All transfers</Link>} />
              <TransferTable transfers={pending.data ?? []} onChanged={reloadAll} emptyMessage="No pending requests." />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
