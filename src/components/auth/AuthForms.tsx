'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function SignupForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: data.get('email'), password: data.get('password'),
        passwordConfirmation: data.get('passwordConfirmation'),
        termsAccepted: data.get('termsAccepted') === 'on', privacyAccepted: data.get('privacyAccepted') === 'on',
      }),
    });
    const payload = await response.json() as { message: string };
    setMessage(payload.message); setPending(false);
  }
  return <AuthCard title="회원가입" message={message}>
    <form className="space-y-4" onSubmit={submit} aria-describedby={message ? 'auth-form-status' : undefined}>
      <Field name="email" label="이메일" type="email" autoComplete="email" />
      <Field name="password" label="비밀번호" type="password" autoComplete="new-password" />
      <Field name="passwordConfirmation" label="비밀번호 확인" type="password" autoComplete="new-password" />
      <label className="flex gap-2 text-sm"><input required name="termsAccepted" type="checkbox" /> 이용약관에 동의합니다.</label>
      <label className="flex gap-2 text-sm"><input required name="privacyAccepted" type="checkbox" /> 개인정보 처리에 동의합니다.</label>
      <Button className="w-full" disabled={pending} type="submit">{pending ? '처리 중…' : '가입 확인 이메일 받기'}</Button>
    </form>
  </AuthCard>;
}

export function RecoveryForm({ mode = 'request' }: { mode?: 'request' | 'change' }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage(null);
    try {
      if (mode === 'change') {
        const password = String(data.get('password') ?? '');
        if (password !== String(data.get('passwordConfirm') ?? '')) {
          setMessage('비밀번호 확인 값이 일치하지 않습니다.');
          return;
        }
        const response = await fetch('/api/auth/password', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
        });
        const payload = await response.json() as { message?: string; next?: string };
        if (!response.ok) throw new Error(payload.message ?? '비밀번호를 변경할 수 없습니다.');
        window.location.assign(payload.next ?? '/login');
        return;
      }
      const response = await fetch('/api/auth/recovery', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: data.get('email') }),
      });
      const payload = await response.json() as { message: string };
      setMessage(payload.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '요청을 처리할 수 없습니다.');
    } finally {
      setPending(false);
    }
  }
  return <AuthCard title={mode === 'change' ? '새 비밀번호 설정' : '비밀번호 재설정'} message={message}>
    <form className="space-y-4" onSubmit={submit} aria-describedby={message ? 'auth-form-status' : undefined}>
      {mode === 'change' ? <>
        <Field name="password" label="새 비밀번호" type="password" autoComplete="new-password" />
        <Field name="passwordConfirm" label="새 비밀번호 확인" type="password" autoComplete="new-password" />
      </> : <Field name="email" label="이메일" type="email" autoComplete="email" />}
      <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? '처리 중' : mode === 'change' ? '비밀번호 변경' : '재설정 이메일 받기'}
      </Button>
    </form>
  </AuthCard>;
}

function Field(props: { name: string; label: string; type: string; autoComplete: string }) {
  const id = `auth-${props.name}`;
  return <label htmlFor={id} className="block text-sm font-semibold">{props.label}<input id={id} required className="mt-2 h-12 w-full rounded-xl border border-app-border px-3 outline-none focus-visible:ring-2 focus-visible:ring-app-blue" {...props} /></label>;
}

function AuthCard({ title, message, children }: { title: string; message: string | null; children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-app-background px-5 py-8"><Card className="w-full max-w-md space-y-5">
    <h1 className="text-2xl font-black">{title}</h1>{children}
    {message ? <p id="auth-form-status" role="status" aria-live="polite" className="rounded-xl bg-blue-50 p-3 text-sm">{message}</p> : null}
    <Link className="inline-flex min-h-11 items-center rounded-lg font-bold text-app-blue outline-none focus-visible:ring-2 focus-visible:ring-app-blue" href="/login">로그인으로 돌아가기</Link>
  </Card></main>;
}
