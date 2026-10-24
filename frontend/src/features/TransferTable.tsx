import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { approveTransfer, cancelTransfer, dispatchTransfer, receiveTransfer, rejectTransfer } from '../api/transfers';
import { getErrorMessage } from '../api/client';
import type { Transfer } from '../api/types';
import { Button, ConfirmDialog, DataTable, Modal, StatusBadge, Textarea, useToast, type Column } from '../components/ui';
import { fmtAgo, RESOURCE_LABEL } from '../lib/format';

type Pending =
  | { kind: 'reject' | 'cancel'; t: Transfer }
  | { kind: 'approve' | 'transit' | 'receive'; t: Transfer };

const copy = {
  approve: { title: 'Approve transfer?', label: 'Approve', danger: false },
  transit: { title: 'Mark as dispatched?', label: 'Mark in transit', danger: false },
  receive: { title: 'Confirm receipt?', label: 'Confirm received', danger: false },
  reject: { title: 'Reject transfer', label: 'Reject', danger: true },
  cancel: { title: 'Cancel transfer', label: 'Cancel transfer', danger: true },
} as const;

/** Transfers with per-status, per-role actions driven by the server's `actions` flags. */
export function TransferTable({ transfers, onChanged, emptyMessage }: { transfers: Transfer[]; onChanged: () => void; emptyMessage?: string }) {
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPending(null);
    setReason('');
  };

  const run = async () => {
    if (!pending) return;
    const { kind, t } = pending;
    setBusy(true);
    try {
      if (kind === 'approve') await approveTransfer(t.id);
      else if (kind === 'reject') await rejectTransfer(t.id, reason.trim() || undefined);
      else if (kind === 'transit') await dispatchTransfer(t.id);
      else if (kind === 'receive') await receiveTransfer(t.id);
      else await cancelTransfer(t.id, reason.trim() || undefined);
      toast.success(`Transfer ${kind === 'transit' ? 'dispatched' : kind === 'receive' ? 'received' : kind + (kind.endsWith('e') ? 'd' : 'ed')}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Transfer action failed'));
    } finally {
      setBusy(false);
      close();
      onChanged(); // always refresh: the failure may be a state change made elsewhere
    }
  };

  const columns: Column<Transfer>[] = [
    {
      key: 'route',
      header: 'Route',
      sortValue: (t) => t.fromShelter.name,
      render: (t) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
          {t.fromShelter.name} <ArrowRight className="h-3.5 w-3.5 text-gray-400" /> {t.toShelter.name}
        </span>
      ),
    },
    { key: 'item', header: 'Item', sortValue: (t) => t.resourceType, render: (t) => `${t.quantity.toLocaleString('en-IN')} × ${RESOURCE_LABEL[t.resourceType]}` },
    { key: 'status', header: 'Status', sortValue: (t) => t.status, render: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'who',
      header: 'People',
      render: (t) => (
        <div className="text-xs text-gray-600">
          <p>Requested by {t.requestedBy.name}</p>
          {t.approvedBy && <p>{t.status === 'REJECTED' ? 'Rejected' : 'Approved'} by {t.approvedBy.name}</p>}
          {t.receivedBy && <p>Received by {t.receivedBy.name}</p>}
          {t.cancelledBy && <p>Cancelled by {t.cancelledBy.name}</p>}
          {(t.reason || t.rejectionReason) && <p className="text-gray-500 italic">“{t.rejectionReason || t.reason}”</p>}
        </div>
      ),
    },
    { key: 'when', header: 'Requested', sortValue: (t) => t.createdAt, render: (t) => <span className="text-xs text-gray-500">{fmtAgo(t.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (t) => (
        <div className="flex justify-end gap-1 flex-wrap">
          {t.actions.approve && <Button size="sm" variant="success" onClick={() => setPending({ kind: 'approve', t })}>Approve</Button>}
          {t.actions.reject && <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'reject', t })}>Reject</Button>}
          {t.actions.transit && <Button size="sm" onClick={() => setPending({ kind: 'transit', t })}>Dispatch</Button>}
          {t.actions.receive && <Button size="sm" variant="success" onClick={() => setPending({ kind: 'receive', t })}>Receive</Button>}
          {t.actions.cancel && <Button size="sm" variant="ghost" onClick={() => setPending({ kind: 'cancel', t })}>Cancel</Button>}
        </div>
      ),
    },
  ];

  const needsReason = pending?.kind === 'reject' || pending?.kind === 'cancel';
  const t = pending?.t;
  const consequence =
    pending &&
    t &&
    {
      approve: `Approving deducts ${t.quantity} ${RESOURCE_LABEL[t.resourceType].toLowerCase()} from ${t.fromShelter.name} immediately.`,
      transit: 'Marks the goods as dispatched. Stock does not change.',
      receive: `Adds ${t.quantity} ${RESOURCE_LABEL[t.resourceType].toLowerCase()} to ${t.toShelter.name}.`,
      reject: 'No stock will move.',
      cancel: t.status === 'PENDING' ? 'No stock has moved, so nothing needs restoring.' : `The ${t.quantity} already deducted will be restored to ${t.fromShelter.name}.`,
    }[pending.kind];

  return (
    <>
      <DataTable columns={columns} rows={transfers} rowKey={(x) => x.id} initialSort={{ key: 'when', dir: 'desc' }} emptyTitle="No transfers" emptyMessage={emptyMessage} />
      {pending && needsReason ? (
        <Modal
          open
          onClose={close}
          title={copy[pending.kind].title}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={close} disabled={busy}>Back</Button>
              <Button variant="danger" onClick={run} loading={busy}>{copy[pending.kind].label}</Button>
            </>
          }
        >
          <p className="text-sm text-gray-600 mb-3">{consequence}</p>
          <Textarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!pending}
          title={pending ? copy[pending.kind].title : ''}
          confirmLabel={pending ? copy[pending.kind].label : ''}
          loading={busy}
          onCancel={close}
          onConfirm={run}
          message={consequence}
        />
      )}
    </>
  );
}
