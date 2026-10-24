import { useState } from 'react';
import { updateDonation } from '../api/donations';
import { getErrorMessage } from '../api/client';
import type { Donation } from '../api/types';
import { Button, ConfirmDialog, DataTable, StatusBadge, useToast, type Column } from '../components/ui';
import { fmtDateTime, RESOURCE_LABEL } from '../lib/format';

/** Donation list with accept (applies inventory once) / reject for pending ones. */
export function DonationTable({ donations, onChanged, showShelter }: { donations: Donation[]; onChanged: () => void; showShelter?: boolean }) {
  const toast = useToast();
  const [target, setTarget] = useState<{ d: Donation; status: 'ACCEPTED' | 'REJECTED' } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await updateDonation(target.d.id, { status: target.status });
      toast.success(target.status === 'ACCEPTED' ? `Accepted — ${target.d.quantity} ${target.d.unit} added to stock` : 'Donation rejected');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update donation'));
    } finally {
      setBusy(false);
      setTarget(null);
      onChanged();
    }
  };

  const columns: Column<Donation>[] = [
    { key: 'date', header: 'Received', sortValue: (d) => d.receivedDate, render: (d) => <span className="text-xs">{fmtDateTime(d.receivedDate)}</span> },
    {
      key: 'donor',
      header: 'Donor',
      sortValue: (d) => d.donorName.toLowerCase(),
      render: (d) => (
        <div>
          <p className="font-medium text-gray-900">{d.donorName}</p>
          {showShelter && <p className="text-xs text-gray-500">{d.shelter.name}</p>}
          {d.notes && <p className="text-xs text-gray-500">{d.notes}</p>}
        </div>
      ),
    },
    { key: 'item', header: 'Item', sortValue: (d) => d.resourceType, render: (d) => `${d.quantity.toLocaleString('en-IN')} ${d.unit} · ${RESOURCE_LABEL[d.resourceType]}` },
    { key: 'receipt', header: 'Receipt', render: (d) => <span className="text-xs text-gray-600">{d.receiptRef ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (d) => d.status,
      render: (d) => (
        <div>
          <StatusBadge status={d.status} />
          {d.status === 'ACCEPTED' && <p className="text-[11px] text-gray-500 mt-0.5">{d.inventoryApplied ? 'Stock updated' : ''}{d.acceptedBy ? ` by ${d.acceptedBy.name}` : ''}</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (d) =>
        d.status === 'PENDING' ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="success" onClick={() => setTarget({ d, status: 'ACCEPTED' })}>Accept</Button>
            <Button size="sm" variant="secondary" onClick={() => setTarget({ d, status: 'REJECTED' })}>Reject</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable columns={columns} rows={donations} rowKey={(d) => d.id} initialSort={{ key: 'date', dir: 'desc' }} emptyTitle="No donations recorded" />
      <ConfirmDialog
        open={!!target}
        danger={target?.status === 'REJECTED'}
        title={target?.status === 'ACCEPTED' ? 'Accept donation?' : 'Reject donation?'}
        confirmLabel={target?.status === 'ACCEPTED' ? 'Accept & add to stock' : 'Reject'}
        loading={busy}
        onCancel={() => setTarget(null)}
        onConfirm={run}
        message={
          target &&
          (target.status === 'ACCEPTED'
            ? `${target.d.quantity} ${target.d.unit} of ${RESOURCE_LABEL[target.d.resourceType].toLowerCase()} from ${target.d.donorName} will be added to ${target.d.shelter.name}. This happens once and cannot be repeated.`
            : `The donation from ${target.d.donorName} will be marked rejected. Stock is not changed.`)
        }
      />
    </>
  );
}
