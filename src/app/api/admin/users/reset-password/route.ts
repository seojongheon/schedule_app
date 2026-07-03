import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AdminPermissionRow = {
  is_service_admin: boolean;
  status: 'active' | 'inactive';
};

const strongPasswordSchema = z
  .string()
  .min(12, '비밀번호는 12자 이상이어야 합니다.')
  .regex(/[A-Z]/, '비밀번호에는 대문자가 포함되어야 합니다.')
  .regex(/[a-z]/, '비밀번호에는 소문자가 포함되어야 합니다.')
  .regex(/[0-9]/, '비밀번호에는 숫자가 포함되어야 합니다.')
  .regex(/[^A-Za-z0-9]/, '비밀번호에는 특수문자가 포함되어야 합니다.');

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: strongPasswordSchema,
});

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

async function assertServiceAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from('profiles')
    .select('is_service_admin,status')
    .eq('id', user.id)
    .single();

  const profile = data as AdminPermissionRow | null;
  return Boolean(profile?.is_service_admin && profile.status === 'active');
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: '허용되지 않은 요청 출처입니다.' }, { status: 403 });
  }

  const isServiceAdmin = await assertServiceAdmin();

  if (!isServiceAdmin) {
    return NextResponse.json({ message: '서비스 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const parsed = resetPasswordSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const payload = parsed.data;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(payload.userId, {
    password: payload.password,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
