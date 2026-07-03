import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-app border border-app-border bg-white p-4 shadow-soft', className)}
      {...props}
    />
  );
}
