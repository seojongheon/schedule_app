'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      displayName: data.get('displayName'), birthDate: data.get('birthDate'), phone: data.get('phone') || undefined,
      termsVersion: '2026-07', privacyVersion: '2026-07',
    }) });
    const payload = await response.json() as { next?: string; message?: string };
    if (!response.ok) return setError(payload.message ?? '저장할 수 없습니다.');
    router.replace(payload.next ?? '/dashboard');
  }
  return <main className="flex min-h-screen items-center justify-center bg-app-background px-5 py-8"><Card className="w-full max-w-md space-y-5">
    <h1 className="text-2xl font-black">프로필 완성</h1>
    <p className="text-sm text-gray-600">모든 연령이 가입할 수 있으며, 만 14세 미만은 법정대리인 동의가 필요합니다.</p>
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-semibold">표시 이름<input required name="displayName" maxLength={80} className="mt-2 h-12 w-full rounded-xl border px-3" /></label>
      <label className="block text-sm font-semibold">생년월일<input required name="birthDate" type="date" className="mt-2 h-12 w-full rounded-xl border px-3" /></label>
      <label className="block text-sm font-semibold">휴대전화(선택)<input name="phone" inputMode="tel" className="mt-2 h-12 w-full rounded-xl border px-3" /></label>
      {error ? <p role="alert" className="text-sm text-app-danger">{error}</p> : null}
      <Button className="w-full" type="submit">프로필 저장</Button>
    </form>
  </Card></main>;
}
