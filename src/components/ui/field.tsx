import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, className, ...props }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <input
        className={cn(
          'h-11 w-full rounded-xl border border-app-border bg-white px-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-app-blue focus:ring-4 focus:ring-blue-100',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs font-medium text-app-danger">{error}</span> : null}
    </label>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export function TextareaField({ label, className, ...props }: TextareaFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <textarea
        className={cn(
          'min-h-24 w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-app-blue focus:ring-4 focus:ring-blue-100',
          className,
        )}
        {...props}
      />
    </label>
  );
}
