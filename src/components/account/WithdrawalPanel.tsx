'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function WithdrawalPanel({ deletionDueAt }: { deletionDueAt: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancelWithdrawal() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/privacy/withdraw/cancel', { method: 'POST' });
      const body = await response.json() as { next?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? '탈퇴 요청을 취소할 수 없습니다.');
      window.location.assign(body.next ?? '/dashboard');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '탈퇴 요청을 취소할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-xl px-4 py-12">
    <Card>
      <h1 className="text-2xl font-bold text-gray-900">계정 탈퇴 대기 중</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        서비스 이용과 기존 세션은 중지되었습니다. 개인정보 삭제 예정 시각은{' '}
        <strong className="text-gray-900">{new Date(deletionDueAt).toLocaleString('ko-KR')}</strong>입니다.
      </p>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        삭제 처리가 시작되기 전까지 탈퇴 요청을 취소할 수 있습니다.
      </p>
      {message ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
      <Button className="mt-6 w-full" type="button" disabled={busy} onClick={cancelWithdrawal}>
        {busy ? '처리 중…' : '탈퇴 요청 취소'}
      </Button>
    </Card>
  </main>;
}
