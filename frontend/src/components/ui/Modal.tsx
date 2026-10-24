import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 'drawer' slides in from the right (forms, history); 'modal' is centred. */
  variant?: 'modal' | 'drawer';
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export function Modal({ open, onClose, title, children, footer, variant = 'modal', size = 'md' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const drawer = variant === 'drawer';

  return (
    <div className={clsx('fixed inset-0 z-[90] flex', drawer ? 'justify-end' : 'items-center justify-center p-4')}>
      <div className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative bg-white shadow-xl flex flex-col w-full',
          drawer ? 'h-full max-w-lg' : clsx('rounded-xl max-h-[90vh]', sizes[size])
        )}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-xl">{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Required for every destructive action (checkout, deactivate, reject, cancel…). */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-gray-600">{message}</div>
    </Modal>
  );
}
