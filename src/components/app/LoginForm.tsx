'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { normalizeLoginIdentifier } from '@/lib/account';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type LoginProfileRow = {
  status: 'active' | 'inactive';
};

const loginSchema = z.object({
  account: z.string().min(1, '아이디 또는 이메일을 입력해주세요.'),
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
      const supabase = createSupabaseBrowserClient();
      const email = normalizeLoginIdentifier(values.account);
      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email,
        password: values.password,
      });

      if (signInError) {
        setError('아이디 또는 비밀번호를 확인해주세요.');
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.user.id)
          .single();

        const loginProfile = profile as LoginProfileRow | null;

        if (loginProfile?.status === 'inactive') {
          await supabase.auth.signOut();
          setError('비활성화된 계정입니다. 관리자에게 문의해주세요.');
          return;
        }
      }
    } catch {
      // Supabase 환경변수가 없는 데모 모드에서는 화면 확인을 위해 이동을 허용합니다.
    }

    if (values.remember) {
      window.localStorage.setItem('shared-schedule-remember', values.account);
    }

    router.replace('/dashboard');
    router.refresh();
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
                아이디 또는 이메일
              </label>
              <input
                id="account"
                type="text"
                placeholder="아이디 또는 이메일을 입력하세요"
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
                onClick={() => setError('비밀번호 재설정은 서비스 관리자에게 요청해주세요.')}
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

          <Card className="text-center text-xs leading-5 text-gray-500">
            관리자에게 발급받은 계정으로만 이용할 수 있습니다. 회원가입은 지원하지 않습니다.
          </Card>
        </form>
      </div>
    </div>
  );
}
