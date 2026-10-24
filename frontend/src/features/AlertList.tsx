import { useState } from 'react';
import { Link } from 'react-router-dom';
import { acknowledgeAlert, resolveAlert } from '../api/alerts';
import { getErrorMessage } from '../api/client';
import type { Alert, AlertStatus, AlertType } from '../api/types';
import { Button, Select, StatusBadge, useToast, EmptyState } from '../components/ui';
import { fmtAgo } from '../lib/format';

const TYPE_LABEL: Record<AlertType, string> = {
  LOW_STOCK: 'Low stock',
  OVERCROWDING: 'Overcrowding',
  FULL_SHELTER: 'Shelter full',
  CRITICAL_MEDICAL_NEED: 'Critical medical need',
  TRANSFER_REQUIRED: 'Transfer suggested',
};

/** Alert list with status/type filters and acknowledge / resolve actions (server enforces scope). */
export function AlertList({
  alerts, onChanged, shelterLink, showFilters = true, compact,
}: { alerts: Alert[]; onChanged: () => void; shelterLink?: (shelterId: string) => string; showFilters?: boolean; compact?: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<AlertStatus | ''>('');
  const [type, setType] = useState<AlertType | ''>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = alerts.filter((a) => (!status || a.status === status) && (!type || a.alertType === type));

  const act = async (a: Alert, kind: 'ack' | 'resolve') => {
    setBusyId(a.id);
    try {
      await (kind === 'ack' ? acknowledgeAlert(a.id) : resolveAlert(a.id));
      toast.success(kind === 'ack' ? 'Alert acknowledged' : 'Alert resolved');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update alert'));
    } finally {
      setBusyId(null);
      onChanged();
    }
  };

  return (
    <div>
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as AlertStatus | '')} wrapperClassName="w-44">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as AlertType | '')} wrapperClassName="w-56">
            <option value="">All types</option>
            {(Object.keys(TYPE_LABEL) as AlertType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="No alerts" message="Alerts appear automatically when occupancy, stock or medical thresholds are crossed." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((a) => (
            <li key={a.id} className={`px-5 ${compact ? 'py-2.5' : 'py-3.5'} flex flex-wrap items-start justify-between gap-3`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusBadge status={a.severity} />
                  <span className="text-xs font-semibold text-gray-700">{TYPE_LABEL[a.alertType]}</span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-sm text-gray-900">{a.message}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {shelterLink ? <Link className="text-blue-600 hover:underline" to={shelterLink(a.shelter.id)}>{a.shelter.name}</Link> : a.shelter.name} · {fmtAgo(a.triggeredAt)}
                  {a.acknowledgedBy && ` · acknowledged by ${a.acknowledgedBy.name}`}
                  {a.status === 'RESOLVED' && (a.resolvedBy ? ` · resolved by ${a.resolvedBy.name}` : ' · cleared automatically')}
                </p>
              </div>
              {a.status !== 'RESOLVED' && (
                <div className="flex gap-1">
                  {a.status === 'ACTIVE' && (
                    <Button size="sm" variant="secondary" loading={busyId === a.id} onClick={() => act(a, 'ack')}>Acknowledge</Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => act(a, 'resolve')}>Resolve</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
