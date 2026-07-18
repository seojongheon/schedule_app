'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      displayName: data.get('displayName'), birthDate: data.get('birthDate'), phone: data.get('phone') || undefined,
      termsVersion: '2026-07', privacyVersion: '2026-07',
    }) });
    const payload = await response.json() as { next?: string; message?: string };
    if (!response.ok) { setPending(false); return setError(payload.message ?? '저장할 수 없습니다.'); }
    router.replace(payload.next ?? '/dashboard');
  }
  return <main className="flex min-h-screen items-center justify-center bg-app-background px-5 py-8"><Card className="w-full max-w-md space-y-5">
    <h1 className="text-2xl font-black">프로필 완성</h1>
    <p className="text-sm text-gray-600">모든 연령이 가입할 수 있으며, 만 14세 미만은 법정대리인 동의가 필요합니다.</p>
    <form className="space-y-4" onSubmit={submit} aria-describedby={error ? 'profile-error' : undefined}>
      <label htmlFor="profile-display-name" className="block text-sm font-semibold">표시 이름<input id="profile-display-name" required name="displayName" maxLength={80} className="mt-2 h-12 w-full rounded-xl border px-3 outline-none focus-visible:ring-2 focus-visible:ring-app-blue" /></label>
      <label htmlFor="profile-birth-date" className="block text-sm font-semibold">생년월일<input id="profile-birth-date" required name="birthDate" type="date" className="mt-2 h-12 w-full rounded-xl border px-3 outline-none focus-visible:ring-2 focus-visible:ring-app-blue" /></label>
      <label htmlFor="profile-phone" className="block text-sm font-semibold">휴대전화(선택)<input id="profile-phone" name="phone" inputMode="tel" className="mt-2 h-12 w-full rounded-xl border px-3 outline-none focus-visible:ring-2 focus-visible:ring-app-blue" /></label>
      {error ? <p id="profile-error" role="alert" className="text-sm text-app-danger">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>{pending ? '저장 중…' : '프로필 저장'}</Button>
    </form>
  </Card></main>;
}
