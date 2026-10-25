import { useId } from 'react';

// Plain SVG/CSS charts (no chart library). Colours are fixed tokens that work on a white card.
const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#64748b'];

export interface Datum {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal bar chart: label, bar proportional to the max, value. */
export function BarChart({ data, unit = '', emptyText = 'No data' }: { data: Datum[]; unit?: string; emptyText?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-gray-500">{emptyText}</p>;
  return (
    <ul className="space-y-2" role="list">
      {data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-gray-700" title={d.label}>{d.label}</span>
          <span className="h-3 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
          </span>
          <span className="tabular-nums font-medium text-gray-900">{d.value.toLocaleString('en-IN')}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

export interface StackSegment {
  label: string;
  value: number;
  color: string;
}

/** Single stacked horizontal bar with a legend (e.g. stock status mix, transfers by status). */
export function StackedBar({ segments, total }: { segments: StackSegment[]; total?: number }) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  if (sum <= 0) return <p className="text-sm text-gray-500">No data</p>;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <span key={s.label} style={{ width: `${(s.value / sum) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.label} <strong className="text-gray-900">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Donut with the headline number in the middle. */
export function Donut({ segments, centerLabel, size = 140 }: { segments: StackSegment[]; centerLabel?: string; size?: number }) {
  const id = useId();
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = 48;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-labelledby={id}>
        <title id={id}>{segments.map((s) => `${s.label} ${s.value}`).join(', ')}</title>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {total > 0 &&
          segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle key={s.label} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
            );
            offset += len;
            return el;
          })}
        <text x="60" y="58" textAnchor="middle" className="fill-gray-900" style={{ fontSize: 20, fontWeight: 700 }}>{total.toLocaleString('en-IN')}</text>
        {centerLabel && <text x="60" y="74" textAnchor="middle" className="fill-gray-500" style={{ fontSize: 9 }}>{centerLabel}</text>}
      </svg>
      <ul className="space-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-2 w-full">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-gray-700">{s.label}</span>
            <strong className="ml-auto pl-4 text-gray-900 tabular-nums">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
