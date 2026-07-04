'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
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
  const dragStartY = useRef(0);
  const latestDragY = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      latestDragY.current = 0;
      setDragY(0);
      setIsDragging(false);
      activePointerId.current = null;
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    activePointerId.current = event.pointerId;
    dragStartY.current = event.clientY - dragY;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || activePointerId.current !== event.pointerId) {
      return;
    }

    const nextDragY = Math.max(0, event.clientY - dragStartY.current);
    latestDragY.current = nextDragY;
    setDragY(nextDragY);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || activePointerId.current !== event.pointerId) {
      return;
    }

    const shouldClose = latestDragY.current > 120 || latestDragY.current > window.innerHeight * 0.25;

    setIsDragging(false);
    activePointerId.current = null;

    if (shouldClose) {
      onClose();
      return;
    }

    latestDragY.current = 0;
    setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={description ? 'sheet-description' : undefined}
        style={{ transform: `translateY(${dragY}px)` }}
        className={cn(
          'max-h-[92vh] w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]',
          isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out',
          className,
        )}
      >
        <div
          className="cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-300" />
        </div>
        <header
          className="flex cursor-grab touch-none items-start justify-between gap-4 border-b border-app-border px-5 py-4 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <div>
            <h2 id="sheet-title" className="text-lg font-bold text-gray-950">{title}</h2>
            {description ? <p id="sheet-description" className="mt-1 text-xs text-gray-500">{description}</p> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            aria-label="시트 닫기"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="max-h-[66vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-app-border bg-white p-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
