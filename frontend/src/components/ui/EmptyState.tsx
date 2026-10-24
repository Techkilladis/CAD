import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="p-3 bg-gray-100 rounded-full text-gray-400 mb-3">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {message && <p className="text-sm text-gray-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between gap-3" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}
