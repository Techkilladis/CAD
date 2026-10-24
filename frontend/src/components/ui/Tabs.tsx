import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Tabs<K extends string>({ tabs, active, onChange }: { tabs: TabItem<K>[]; active: K; onChange: (k: K) => void }) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <nav className="-mb-px flex gap-1 min-w-max" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              active === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={clsx('ml-2 rounded-full px-2 py-0.5 text-xs', active === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
