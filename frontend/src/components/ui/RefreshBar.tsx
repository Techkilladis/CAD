import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from './Button';

/**
 * "Current status as of 14:32 · Refresh". The app never claims real-time data; users refresh manually
 * or opt into 30 s polling.
 */
export function RefreshBar({
  asOf, onRefresh, loading, polling, onTogglePolling,
}: {
  asOf: Date | string | null;
  onRefresh: () => void;
  loading?: boolean;
  polling?: boolean;
  onTogglePolling?: (v: boolean) => void;
}) {
  const when = asOf ? format(new Date(asOf), 'HH:mm:ss') : '—';
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span>Current status as of {when}</span>
      <Button size="sm" variant="secondary" onClick={onRefresh} loading={loading} icon={<RefreshCw className="h-3.5 w-3.5" />}>
        Refresh
      </Button>
      {onTogglePolling && (
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={!!polling} onChange={(e) => onTogglePolling(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
          Auto-refresh every 30 s
        </label>
      )}
    </div>
  );
}
