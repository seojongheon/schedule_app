import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, className, ...props }: FieldProps) {
  const inputId = props.id ?? (props.name ? `field-${props.name}` : undefined);
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  return (
    <label htmlFor={inputId} className="block space-y-2">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'h-11 w-full rounded-xl border border-app-border bg-white px-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-app-blue focus:ring-4 focus:ring-blue-100',
          className,
        )}
        {...props}
      />
      {error ? <span id={errorId} role="alert" className="text-xs font-medium text-app-danger">{error}</span> : null}
    </label>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export function TextareaField({ label, className, ...props }: TextareaFieldProps) {
  const textareaId = props.id ?? (props.name ? `field-${props.name}` : undefined);
  return (
    <label htmlFor={textareaId} className="block space-y-2">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <textarea
        id={textareaId}
        className={cn(
          'min-h-24 w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-app-blue focus:ring-4 focus:ring-blue-100',
          className,
        )}
        {...props}
      />
    </label>
  );
}
