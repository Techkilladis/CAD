import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { checkOutFamily } from '../api/checkins';
import { getErrorMessage } from '../api/client';
import type { Checkin } from '../api/types';
import { Button, ConfirmDialog, DataTable, StatusBadge, useToast, type Column } from '../components/ui';
import { fmtDateTime, PRIORITY_RANK } from '../lib/format';

/** Active occupants with sortable columns and a confirmed checkout. */
export function OccupantTable({
  shelterId, occupants, onChanged, canCheckout = true,
}: { shelterId: string; occupants: Checkin[]; onChanged: () => void; canCheckout?: boolean }) {
  const toast = useToast();
  const [target, setTarget] = useState<Checkin | null>(null);
  const [busy, setBusy] = useState(false);

  const doCheckout = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await checkOutFamily(shelterId, target.id);
      toast.success(`${target.personName} checked out — ${target.familySize} bed(s) freed`);
      setTarget(null);
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Checkout failed'));
      setTarget(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Checkin>[] = [
    {
      key: 'name',
      header: 'Family',
      sortValue: (c) => c.personName.toLowerCase(),
      render: (c) => (
        <div>
          <p className="font-medium text-gray-900">{c.personName}</p>
          {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
        </div>
      ),
    },
    { key: 'size', header: 'Size', sortValue: (c) => c.familySize, render: (c) => c.familySize },
    {
      key: 'needs',
      header: 'Needs',
      render: (c) => (
        <span className="text-xs text-gray-600">
          {[c.childrenCount > 0 && `${c.childrenCount} child`, c.elderlyCount > 0 && `${c.elderlyCount} elderly`, c.pregnantFlag && 'pregnant', c.disabledFlag && 'disability', c.medicalFlag && 'medical']
            .filter(Boolean)
            .join(', ') || '—'}
        </span>
      ),
    },
    { key: 'priority', header: 'Priority', sortValue: (c) => PRIORITY_RANK[c.priority], render: (c) => <StatusBadge status={c.priority} context="priority" /> },
    { key: 'in', header: 'Checked in', sortValue: (c) => c.checkedInAt, render: (c) => <span className="text-xs text-gray-500">{fmtDateTime(c.checkedInAt)}</span> },
  ];
  if (canCheckout) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <Button size="sm" variant="secondary" icon={<LogOut className="h-3.5 w-3.5" />} onClick={() => setTarget(c)}>
          Check out
        </Button>
      ),
    });
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={occupants}
        rowKey={(c) => c.id}
        initialSort={{ key: 'priority', dir: 'desc' }}
        pageSize={12}
        emptyTitle="No active occupants"
        emptyMessage="Families appear here once they are checked in."
      />
      <ConfirmDialog
        open={!!target}
        title="Check out family?"
        confirmLabel="Check out"
        danger
        loading={busy}
        onCancel={() => setTarget(null)}
        onConfirm={doCheckout}
        message={
          target && (
            <>
              <strong>{target.personName}</strong> ({target.familySize} {target.familySize === 1 ? 'person' : 'people'}) will leave the shelter and {target.familySize} bed(s) will be freed.
            </>
          )
        }
      />
    </>
  );
}
