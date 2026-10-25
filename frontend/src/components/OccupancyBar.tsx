import clsx from 'clsx';
import { occupancyColor } from '../lib/format';

export function OccupancyBar({ occupied, total, className, showLabel = true }: { occupied: number; total: number; className?: string; showLabel?: boolean }) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>
            {occupied} / {total} beds
          </span>
          <span className="font-medium">{pct}%</span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={clsx('h-full rounded-full transition-all', occupancyColor(pct))} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
