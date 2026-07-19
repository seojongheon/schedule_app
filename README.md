# 공유 스케줄

관리자가 발급한 계정으로 로그인하고, 여러 스케줄링 방의 일정과 예비 할 일을 함께 관리하는 모바일 우선 웹 애플리케이션입니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Supabase Auth, PostgreSQL, RLS
- Tailwind CSS
- React Hook Form, Zod
- date-fns
- lucide-react

## 로컬 실행

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 환경 변수

`.env.example`을 참고해 `.env.local`을 생성하세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

서버 전용 키인 `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

## 데이터베이스

Supabase 마이그레이션은 `supabase/migrations` 폴더에 있습니다.

현재 포함된 마이그레이션:

- `20260702013000_shared_schedule_schema.sql`
- `20260703090000_fix_room_creation_rpc.sql`

마이그레이션 적용 전에는 Supabase 프로젝트가 연결되어 있어야 합니다.

```bash
supabase db push
```

## 초기 서비스 관리자 생성

초기 관리자 계정은 서버 전용 키가 있는 로컬 환경에서 한 번만 생성하세요.

```bash
INITIAL_ADMIN_ID=your-admin-id INITIAL_ADMIN_PASSWORD='StrongPassword123!' INITIAL_ADMIN_NAME='관리자' npm run admin:create-initial
```

운영 환경에서는 12자 이상, 대문자, 소문자, 숫자, 특수문자를 포함한 강한 비밀번호를 사용하세요.

## 배포 전 점검

```bash
npm run predeploy:check
```

위 명령은 타입 검사, 린트, 프로덕션 빌드를 순서대로 실행합니다.

자세한 저장소 운영, Vercel, Supabase 배포 및 검증 절차는 [PROJECT_PLAYBOOK.md](./PROJECT_PLAYBOOK.md)를 확인하세요.
