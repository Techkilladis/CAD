import { useState } from 'react';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { cancelSignup, listShifts, signUpForShift } from '../../api/volunteers';
import { getErrorMessage } from '../../api/client';
import type { Shift } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, EmptyState, ErrorState, PageLoader, RefreshBar, Select, StatusBadge, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { fmtDateTime } from '../../lib/format';

/** Browse upcoming shifts and sign up. The server enforces capacity, start time and overlap rules. */
export function VolunteerShiftsPage() {
  const toast = useToast();
  const { data, loading, error, reload, loadedAt } = useLoad<Shift[]>(() => listShifts({ upcoming: true }), []);
  const [shelter, setShelter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const shelters = Array.from(new Map((data ?? []).map((s) => [s.shelter.id, s.shelter.name])));
  const rows = (data ?? []).filter((s) => !shelter || s.shelterId === shelter);

  const act = async (s: Shift, kind: 'signup' | 'cancel') => {
    setBusyId(s.id);
    try {
      if (kind === 'signup') await signUpForShift(s.id);
      else await cancelSignup(s.id);
      toast.success(kind === 'signup' ? `You are signed up for “${s.title}”` : 'Your sign-up was cancelled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update your sign-up'));
    } finally {
      setBusyId(null);
      void reload();
    }
  };

  return (
    <div>
      <PageHeader title="Available shifts" subtitle="Sign up to help at a shelter near you" actions={<RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />} />
      <div className="w-64 mb-4">
        <Select label="Shelter" value={shelter} onChange={(e) => setShelter(e.target.value)}>
          <option value="">All shelters</option>
          {shelters.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
        </Select>
      </div>
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && rows.length === 0 && <Card><EmptyState title="No upcoming shifts" message="Check back soon — coordinators post new shifts as needs arise." /></Card>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((s) => {
          const started = s.hasStarted;
          return (
            <Card key={s.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{s.title}</h2>
                {s.signedUp ? <span className="inline-flex rounded-full bg-green-100 text-green-800 ring-1 ring-inset ring-green-200 px-2.5 py-0.5 text-xs font-medium">Signed up</span> : s.isFull ? <StatusBadge status="FULL" /> : <StatusBadge status="OPEN" />}
              </div>
              {s.task && <p className="text-sm text-gray-600 mt-0.5">{s.task}</p>}
              <dl className="mt-3 space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" />{s.shelter.name}</div>
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gray-400" />{fmtDateTime(s.startTime)}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />until {fmtDateTime(s.endTime).slice(-5)}</div>
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-gray-400" />{s.filledCount}/{s.requiredCount} volunteers</div>
              </dl>
              {s.notes && <p className="text-xs text-gray-500 mt-2">{s.notes}</p>}
              <div className="mt-auto pt-4">
                {s.signedUp ? (
                  <Button variant="secondary" className="w-full" loading={busyId === s.id} disabled={started} onClick={() => act(s, 'cancel')}>
                    {started ? 'Already started' : 'Cancel my sign-up'}
                  </Button>
                ) : (
                  <Button className="w-full" loading={busyId === s.id} disabled={s.isFull || started} onClick={() => act(s, 'signup')}>
                    {started ? 'Already started' : s.isFull ? 'Shift full' : 'Sign up'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
