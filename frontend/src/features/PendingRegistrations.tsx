import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { confirmCheckin, rejectCheckin } from '../api/checkins';
import { getErrorMessage } from '../api/client';
import type { Checkin } from '../api/types';
import { Button, ConfirmDialog, DataTable, StatusBadge, useToast, type Column } from '../components/ui';
import { fmtAgo } from '../lib/format';

/** Public registrations awaiting confirmation at the front desk (reference code lookup). */
export function PendingRegistrations({ shelterId, pending, onChanged }: { shelterId: string; pending: Checkin[]; onChanged: () => void }) {
  const toast = useToast();
  const [rejecting, setRejecting] = useState<Checkin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirm = async (c: Checkin) => {
    setBusyId(c.id);
    try {
      await confirmCheckin(shelterId, c.id);
      toast.success(`${c.personName} confirmed — ${c.familySize} bed(s) allocated`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not confirm registration'));
    } finally {
      setBusyId(null);
      onChanged();
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await rejectCheckin(shelterId, rejecting.id);
      toast.success('Registration rejected');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not reject registration'));
    } finally {
      setBusyId(null);
      setRejecting(null);
      onChanged();
    }
  };

  const columns: Column<Checkin>[] = [
    { key: 'code', header: 'Reference', render: (c) => <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">{c.referenceCode}</code> },
    {
      key: 'name',
      header: 'Family',
      render: (c) => (
        <div>
          <p className="font-medium text-gray-900">{c.personName}</p>
          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
        </div>
      ),
    },
    { key: 'size', header: 'Size', render: (c) => c.familySize },
    { key: 'priority', header: 'Priority', render: (c) => <StatusBadge status={c.priority} context="priority" /> },
    { key: 'when', header: 'Registered', render: (c) => <span className="text-xs text-gray-500">{fmtAgo(c.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="success" loading={busyId === c.id} icon={<Check className="h-3.5 w-3.5" />} onClick={() => confirm(c)}>
            Confirm
          </Button>
          <Button size="sm" variant="secondary" disabled={busyId === c.id} icon={<X className="h-3.5 w-3.5" />} onClick={() => setRejecting(c)}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={pending}
        rowKey={(c) => c.id}
        emptyTitle="No pending registrations"
        emptyMessage="Families who register online appear here until you confirm them at the desk."
      />
      <ConfirmDialog
        open={!!rejecting}
        title="Reject registration?"
        confirmLabel="Reject"
        danger
        loading={busyId !== null}
        onCancel={() => setRejecting(null)}
        onConfirm={reject}
        message={rejecting && <>Reject the registration from <strong>{rejecting.personName}</strong> ({rejecting.referenceCode})? No beds are allocated.</>}
      />
    </>
  );
}
