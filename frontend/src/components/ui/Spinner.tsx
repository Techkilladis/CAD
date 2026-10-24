import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-blue-600', className ?? 'h-5 w-5')} aria-hidden />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-gray-500" role="status">
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
