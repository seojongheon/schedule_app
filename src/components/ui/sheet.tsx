'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
}

export function Sheet({ open, title, description, children, footer, onClose, className }: SheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={description ? 'sheet-description' : undefined}
        className={cn(
          'max-h-[92vh] w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]',
          className,
        )}
      >
        <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" />
        <header className="flex items-start justify-between gap-4 border-b border-app-border px-5 py-4">
          <div>
            <h2 id="sheet-title" className="text-lg font-bold text-gray-950">{title}</h2>
            {description ? <p id="sheet-description" className="mt-1 text-xs text-gray-500">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="시트 닫기">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="max-h-[66vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-app-border bg-white p-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
