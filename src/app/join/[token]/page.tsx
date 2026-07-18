'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>(); const router = useRouter();
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  useEffect(() => { fetch(`/api/invites/${encodeURIComponent(token)}`).then((r) => r.json()).then(setPreview).catch(() => setPreview({ result: 'invite_invalid' })); }, [token]);
  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/invites/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: data.get('nickname'), color: '#3558e6' }) });
    const result = await response.json() as { room_id?: string; roomId?: string };
    if (response.ok) router.replace(`/rooms/${result.room_id ?? result.roomId}`);
  }
  return <main className="flex min-h-screen items-center justify-center bg-app-background px-5"><Card className="w-full max-w-md space-y-4">
    <h1 className="text-2xl font-black">방 초대</h1>
    {!preview ? <p aria-live="polite">초대를 확인하고 있습니다.</p> : preview.result !== 'active' ? <p role="alert">사용할 수 없는 초대입니다.</p> : <>
      <p className="font-bold">{preview.roomName}</p><p className="text-sm text-gray-600">{preview.roomDescription}</p>
      <form className="space-y-3" onSubmit={join}><label className="block text-sm font-semibold">방에서 사용할 이름<input required name="nickname" className="mt-2 h-12 w-full rounded-xl border px-3" /></label><Button className="w-full">참여하기</Button></form>
    </>}
  </Card></main>;
}
