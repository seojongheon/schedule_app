'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then(setPreview)
      .catch(() => setPreview({ result: 'invite_invalid' }));
  }, [token]);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsJoining(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: data.get('nickname'), color: '#3558e6' }),
      });
      const result = await response.json() as { roomId?: string; code?: string };
      if (response.ok && result.roomId) {
        router.replace(`/rooms/${result.roomId}`);
        return;
      }
      setMessage(result.code === 'account_not_active' ? '활성 계정으로 로그인한 뒤 참여할 수 있습니다.' : '초대를 사용할 수 없습니다. 새 링크를 요청해주세요.');
    } catch {
      setMessage('초대 참여를 처리하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsJoining(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-app-background px-5"><Card className="w-full max-w-md space-y-4">
    <h1 className="text-2xl font-black">방 초대</h1>
    {!preview ? <p aria-live="polite">초대를 확인하고 있습니다.</p> : preview.result !== 'active' ? <p role="alert">사용할 수 없는 초대입니다.</p> : <>
      <div>
        <p className="font-bold">{preview.roomName}</p>
        {preview.roomDescription ? <p className="mt-1 text-sm text-gray-600">{preview.roomDescription}</p> : null}
        <p className="mt-2 text-xs text-gray-500">권한: {preview.grantRole === 'viewer' ? '보기 전용' : '구성원'} · 만료: {preview.expiresAt ? new Date(preview.expiresAt).toLocaleString('ko-KR') : '-'}</p>
      </div>
      <form className="space-y-3" onSubmit={join}>
        <label className="block text-sm font-semibold">방에서 사용할 이름<input required name="nickname" className="mt-2 h-12 w-full rounded-xl border px-3" /></label>
        <Button className="w-full" disabled={isJoining}>{isJoining ? '참여 처리 중' : '참여하기'}</Button>
      </form>
      {message ? <p role="alert" className="text-sm font-semibold text-app-danger">{message}</p> : null}
    </>}
  </Card></main>;
}
