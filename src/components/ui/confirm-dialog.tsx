'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  disabled,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="w-full max-w-sm rounded-[24px] bg-white p-5 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-app-danger">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 id="confirm-title" className="mt-4 text-lg font-bold text-gray-950">{title}</h2>
        <p id="confirm-description" className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
