'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const loginSchema = z.object({
    account: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
  remember: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      account: '',
      password: '',
      remember: true,
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: values.account, password: values.password, remember: values.remember }),
      });
      const payload = await response.json() as { message?: string; next?: string };
      if (!response.ok) {
        setError(payload.message ?? '로그인할 수 없습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      router.replace(payload.next ?? '/dashboard');
      router.refresh();
    } catch {
      setError('로그인할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-background px-5 py-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-app-blue text-white shadow-soft">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-gray-950">공유 스케줄</h1>
          <p className="mt-2 text-sm text-gray-500">여러 팀의 일정을 한눈에 확인하세요.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Card className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700" htmlFor="account">
                이메일
              </label>
              <input
                id="account"
                type="text"
                placeholder="이메일을 입력하세요"
                className="h-12 w-full rounded-xl border border-app-border px-3 text-sm outline-none focus:border-app-blue focus:ring-4 focus:ring-blue-100"
                {...register('account')}
              />
              {errors.account ? <p className="mt-2 text-xs font-medium text-app-danger">{errors.account.message}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700" htmlFor="password">
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  className="h-12 w-full rounded-xl border border-app-border px-3 pr-12 text-sm outline-none focus:border-app-blue focus:ring-4 focus:ring-blue-100"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-1 top-0 flex h-12 w-11 items-center justify-center text-gray-400"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password ? <p className="mt-2 text-xs font-medium text-app-danger">{errors.password.message}</p> : null}
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 font-semibold text-gray-600">
                <input type="checkbox" className="h-4 w-4 rounded border-app-border" {...register('remember')} />
                로그인 상태 유지
              </label>
              <button
                type="button"
                className="min-h-11 font-bold text-app-blue"
                onClick={() => router.push('/recovery')}
              >
                비밀번호 찾기
              </button>
            </div>
          </Card>

          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-app-danger">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            로그인
          </Button>

          <Card className="space-y-3 text-center text-sm text-gray-600">
            <p>계정이 없으신가요?</p>
            <Link className="inline-flex min-h-11 items-center font-bold text-app-blue" href="/signup">회원가입</Link>
            <div className="grid grid-cols-3 gap-2 pt-2" aria-label="소셜 로그인">
              {(['google', 'kakao', 'naver'] as const).map((provider) => (
                <a key={provider} className="flex min-h-11 items-center justify-center rounded-xl border border-app-border font-semibold capitalize" href={`/api/auth/provider/${provider}/start?mode=signin`}>
                  {provider}
                </a>
              ))}
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
