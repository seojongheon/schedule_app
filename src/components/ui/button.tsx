import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-app-blue text-white shadow-soft hover:bg-blue-700',
        variant === 'secondary' && 'bg-app-blueSoft text-app-blue hover:bg-blue-100',
        variant === 'ghost' && 'bg-transparent text-gray-600 hover:bg-gray-100',
        variant === 'danger' && 'bg-app-danger text-white hover:bg-red-600',
        variant === 'outline' && 'border border-app-border bg-white text-gray-900 hover:bg-gray-50',
        size === 'sm' && 'min-h-11 px-3',
        size === 'md' && 'px-4 py-2.5',
        size === 'lg' && 'min-h-12 px-5',
        size === 'icon' && 'h-11 w-11 rounded-full p-0',
        className,
      )}
      {...props}
    />
  );
}
