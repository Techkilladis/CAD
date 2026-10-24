import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { removeVolunteer, updateShift } from '../api/volunteers';
import { getErrorMessage } from '../api/client';
import type { Shift } from '../api/types';
import { Button, ConfirmDialog, DataTable, StatusBadge, useToast, type Column } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { ShiftForm } from './ShiftForm';

/** Staff shift list with coverage, assigned volunteers, edit and cancel. */
export function ShiftTable({ shifts, onChanged, showShelter }: { shifts: Shift[]; onChanged: () => void; showShelter?: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Shift | null>(null);
  const [cancelling, setCancelling] = useState<Shift | null>(null);
  const [busy, setBusy] = useState(false);

  const doCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await updateShift(cancelling.id, { status: 'CANCELLED' });
      toast.success('Shift cancelled');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel shift'));
    } finally {
      setBusy(false);
      setCancelling(null);
      onChanged();
    }
  };

  const remove = async (s: Shift, volunteerId: string) => {
    try {
      await removeVolunteer(s.id, volunteerId);
      toast.success('Volunteer removed from shift');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove volunteer'));
    } finally {
      onChanged();
    }
  };

  const columns: Column<Shift>[] = [
    {
      key: 'title',
      header: 'Shift',
      sortValue: (s) => s.title.toLowerCase(),
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.title}</p>
          {showShelter && <p className="text-xs text-gray-500">{s.shelter.name}</p>}
          {s.task && <p className="text-xs text-gray-500">{s.task}</p>}
        </div>
      ),
    },
    {
      key: 'time',
      header: 'When',
      sortValue: (s) => s.startTime,
      render: (s) => (
        <span className="text-xs">
          {fmtDateTime(s.startTime)} – {fmtDateTime(s.endTime).slice(-5)}
        </span>
      ),
    },
    {
      key: 'cover',
      header: 'Coverage',
      sortValue: (s) => s.filledCount / s.requiredCount,
      render: (s) => (
        <span className={s.filledCount >= s.requiredCount ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
          {s.filledCount}/{s.requiredCount}
        </span>
      ),
    },
    {
      key: 'who',
      header: 'Volunteers',
      render: (s) =>
        s.assignments && s.assignments.length > 0 ? (
          <ul className="text-xs space-y-0.5">
            {s.assignments.map((a) => (
              <li key={a.id} className="flex items-center gap-1">
                {a.volunteer.name}
                {a.volunteer.phone && <span className="text-gray-400">· {a.volunteer.phone}</span>}
                {s.status === 'OPEN' && !s.hasStarted && (
                  <button aria-label={`Remove ${a.volunteer.name}`} onClick={() => remove(s, a.volunteer.id)} className="text-gray-400 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-gray-400">{s.filledCount ? `${s.filledCount} signed up` : '—'}</span>
        ),
    },
    { key: 'status', header: 'Status', render: (s) => (s.status === 'CANCELLED' ? <StatusBadge status="CANCELLED" /> : s.hasStarted ? <span className="text-xs text-gray-500">Started</span> : <StatusBadge status="OPEN" />) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) =>
        s.assignments !== undefined && s.status === 'OPEN' ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(s)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelling(s)}>Cancel</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable columns={columns} rows={shifts} rowKey={(s) => s.id} initialSort={{ key: 'time', dir: 'asc' }} emptyTitle="No shifts" emptyMessage="Create a shift so volunteers can sign up." />
      <ShiftForm open={!!editing} shift={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
      <ConfirmDialog
        open={!!cancelling}
        danger
        title="Cancel this shift?"
        confirmLabel="Cancel shift"
        loading={busy}
        onCancel={() => setCancelling(null)}
        onConfirm={doCancel}
        message={cancelling && <>“{cancelling.title}” will be cancelled{cancelling.filledCount ? ` and ${cancelling.filledCount} signed-up volunteer(s) will see it as cancelled` : ''}. This cannot be undone.</>}
      />
    </>
  );
}
