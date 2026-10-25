import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

const base =
  'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm shadow-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

function Wrap({ label, error, hint, required, className, id, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

export function Input({ label, error, hint, className, wrapperClassName, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }) {
  const id = useId();
  return (
    <Wrap label={label} error={error} hint={hint} required={rest.required} className={wrapperClassName} id={id}>
      <input id={id} aria-invalid={!!error} className={clsx(base, error ? 'border-red-400' : 'border-gray-300', className)} {...rest} />
    </Wrap>
  );
}

export function Select({
  label, error, hint, className, wrapperClassName, children, ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  const id = useId();
  return (
    <Wrap label={label} error={error} hint={hint} required={rest.required} className={wrapperClassName} id={id}>
      <select id={id} aria-invalid={!!error} className={clsx(base, error ? 'border-red-400' : 'border-gray-300', className)} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function Textarea({ label, error, hint, className, wrapperClassName, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { wrapperClassName?: string }) {
  const id = useId();
  return (
    <Wrap label={label} error={error} hint={hint} required={rest.required} className={wrapperClassName} id={id}>
      <textarea id={id} rows={3} aria-invalid={!!error} className={clsx(base, error ? 'border-red-400' : 'border-gray-300', className)} {...rest} />
    </Wrap>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}
