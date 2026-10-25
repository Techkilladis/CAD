import { useState } from 'react';
import { cancelSignup, myShifts } from '../../api/volunteers';
import { getErrorMessage } from '../../api/client';
import type { Shift } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorState, PageLoader, RefreshBar, StatusBadge, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { fmtDateTime } from '../../lib/format';

export function VolunteerMyShiftsPage() {
  const toast = useToast();
  const { data, loading, error, reload, loadedAt } = useLoad<Shift[]>(myShifts, []);
  const [target, setTarget] = useState<Shift | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date());

  const cancel = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await cancelSignup(target.id);
      toast.success('Sign-up cancelled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel'));
    } finally {
      setBusy(false);
      setTarget(null);
      void reload();
    }
  };

  const upcoming = (data ?? []).filter((s) => new Date(s.endTime) >= now);
  const past = (data ?? []).filter((s) => new Date(s.endTime) < now);

  const Row = ({ s, canCancel }: { s: Shift; canCancel: boolean }) => (
    <li className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium text-gray-900">{s.title}</p>
        <p className="text-xs text-gray-500">{s.shelter.name} · {fmtDateTime(s.startTime)} – {fmtDateTime(s.endTime).slice(-5)}</p>
      </div>
      <div className="flex items-center gap-2">
        {s.status === 'CANCELLED' && <StatusBadge status="CANCELLED" />}
        {canCancel && s.status === 'OPEN' && !s.hasStarted && <Button size="sm" variant="secondary" onClick={() => setTarget(s)}>Cancel sign-up</Button>}
      </div>
    </li>
  );

  return (
    <div>
      <PageHeader title="My shifts" actions={<RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Upcoming" />
            {upcoming.length === 0 ? <EmptyState title="No upcoming shifts" message="Browse available shifts to sign up." /> : <ul className="divide-y divide-gray-100">{upcoming.map((s) => <Row key={s.id} s={s} canCancel />)}</ul>}
          </Card>
          {past.length > 0 && (
            <Card>
              <CardHeader title="Past" />
              <ul className="divide-y divide-gray-100">{past.map((s) => <Row key={s.id} s={s} canCancel={false} />)}</ul>
            </Card>
          )}
        </div>
      )}
      <ConfirmDialog open={!!target} danger title="Cancel sign-up?" confirmLabel="Cancel sign-up" loading={busy} onCancel={() => setTarget(null)} onConfirm={cancel}
        message={target && <>You will be removed from “{target.title}” at {target.shelter.name}.</>} />
    </div>
  );
}
