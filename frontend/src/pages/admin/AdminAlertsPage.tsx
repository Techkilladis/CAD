import { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { listAlerts, runAlertCheck } from '../../api/alerts';
import { getErrorMessage } from '../../api/client';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, ErrorState, PageLoader, RefreshBar, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { AlertList } from '../../features/AlertList';

export function AdminAlertsPage() {
  const toast = useToast();
  const { data, loading, error, reload, loadedAt } = useLoad(() => listAlerts(), []);
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const r = await runAlertCheck();
      toast.success(`Scanned ${r.scanned} shelters: ${r.created} new alert(s), ${r.resolved} resolved`);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Alert check failed'));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Generated from occupancy, stock and medical conditions. Cleared conditions resolve automatically."
        actions={
          <>
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
            <Button icon={<ScanSearch className="h-4 w-4" />} onClick={scan} loading={scanning}>Run alert check</Button>
          </>
        }
      />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <Card>
          <AlertList alerts={data} onChanged={reload} shelterLink={(id) => `/admin/shelters/${id}`} />
        </Card>
      )}
    </div>
  );
}
