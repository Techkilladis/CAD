import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('bg-white rounded-xl border border-gray-200 shadow-sm', className)}>{children}</section>;
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('p-5', className)}>{children}</div>;
}

const tones = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-100 text-gray-600',
};

export function KpiCard({
  label, value, hint, icon, tone = 'blue',
}: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: keyof typeof tones }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3">
      {icon && <div className={clsx('p-2.5 rounded-lg shrink-0', tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
