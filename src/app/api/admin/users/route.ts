import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeLoginIdentifier } from '@/lib/account';
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

const createUserSchema = z
  .object({
    email: z.string().email().optional(),
    loginId: z.string().min(1).optional(),
    password: strongPasswordSchema,
    name: z.string().min(1),
    phone: z.string().nullable().optional(),
    isServiceAdmin: z.boolean().default(false),
    status: z.enum(['active', 'inactive']).default('active'),
  })
  .refine((value) => value.email || value.loginId, {
    message: '이메일 또는 로그인 아이디를 입력해주세요.',
    path: ['loginId'],
  });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  isServiceAdmin: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
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
    return { ok: false as const };
  }

  const { data } = await supabase
    .from('profiles')
    .select('is_service_admin,status')
    .eq('id', user.id)
    .single();

  const profile = data as AdminPermissionRow | null;
  return profile?.is_service_admin && profile.status === 'active'
    ? { ok: true as const, userId: user.id }
    : { ok: false as const };
}

async function countActiveServiceAdmins(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_service_admin', true)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: '허용되지 않은 요청 출처입니다.' }, { status: 403 });
  }

  const actor = await assertServiceAdmin();

  if (!actor.ok) {
    return NextResponse.json({ message: '서비스 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const payload = parsed.data;
  const email = payload.email ?? normalizeLoginIdentifier(payload.loginId ?? '');
  const admin = createSupabaseAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      name: payload.name,
      login_id: payload.loginId ?? null,
    },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ message: authError?.message ?? '사용자 계정을 생성하지 못했습니다.' }, { status: 400 });
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    email,
    name: payload.name,
    phone: payload.phone ?? null,
    is_service_admin: payload.isServiceAdmin,
    status: payload.status,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ message: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    id: authData.user.id,
    email,
    name: payload.name,
    isServiceAdmin: payload.isServiceAdmin,
    status: payload.status,
  });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: '허용되지 않은 요청 출처입니다.' }, { status: 403 });
  }

  const actor = await assertServiceAdmin();

  if (!actor.ok) {
    return NextResponse.json({ message: '서비스 관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const parsed = updateUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' }, { status: 400 });
  }

  const payload = parsed.data;
  const admin = createSupabaseAdminClient();

  if (
    payload.userId === actor.userId
    && (payload.isServiceAdmin === false || payload.status === 'inactive')
  ) {
    return NextResponse.json({ message: '자신의 관리자 권한 또는 계정 상태는 직접 비활성화할 수 없습니다.' }, { status: 400 });
  }

  const { data: targetProfile, error: targetError } = await admin
    .from('profiles')
    .select('is_service_admin,status')
    .eq('id', payload.userId)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ message: targetError?.message ?? '사용자를 찾지 못했습니다.' }, { status: 404 });
  }

  const target = targetProfile as AdminPermissionRow;
  const removesActiveAdmin =
    target.is_service_admin
    && target.status === 'active'
    && (payload.isServiceAdmin === false || payload.status === 'inactive');

  if (removesActiveAdmin && await countActiveServiceAdmins(admin) <= 1) {
    return NextResponse.json({ message: '마지막 활성 서비스 관리자는 해제하거나 비활성화할 수 없습니다.' }, { status: 400 });
  }

  const updates: {
    name?: string;
    phone?: string | null;
    is_service_admin?: boolean;
    status?: 'active' | 'inactive';
  } = {};

  if (payload.name !== undefined) {
    updates.name = payload.name;
  }

  if (payload.phone !== undefined) {
    updates.phone = payload.phone;
  }

  if (payload.isServiceAdmin !== undefined) {
    updates.is_service_admin = payload.isServiceAdmin;
  }

  if (payload.status !== undefined) {
    updates.status = payload.status;
  }

  const { error } = await admin.from('profiles').update(updates).eq('id', payload.userId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
