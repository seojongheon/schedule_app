# 공유 스케줄 배포 튜토리얼

이 문서는 GitHub에 코드를 올리고 Vercel로 배포하기 전에 따라갈 순서입니다. 현재 단계에서는 직접 Git push나 Vercel 배포를 실행하지 않습니다.

## 1. 로컬 최종 점검

먼저 로컬에서 문제가 없는지 확인합니다.

```bash
npm run predeploy:check
```

통과해야 하는 항목:

- TypeScript 타입 검사
- ESLint 검사
- Next.js 프로덕션 빌드

## 2. Git에 올라가면 안 되는 파일 확인

다음 파일과 폴더는 Git에 올리지 않습니다.

- `.env`
- `.env.local`
- `.env.*`
- `.next`
- `node_modules`
- `*.tsbuildinfo`

이미 `.gitignore`에 포함되어 있습니다. 그래도 커밋 전에 아래 명령으로 확인하세요.

```bash
git status
```

만약 `.env.local`, `.next`, `node_modules`가 추적 중으로 보이면 아래 명령으로 Git 추적만 제거하세요. 실제 파일은 삭제되지 않습니다.

```bash
git rm --cached .env .env.local
git rm -r --cached .next node_modules
```

## 3. Git 저장소 초기화

아직 Git 저장소가 아니라면 프로젝트 루트에서 실행합니다.

```bash
git init
git add .
git commit -m "Initial shared schedule app"
```

이미 Git 저장소라면 `git init`은 생략하고 변경사항만 커밋합니다.

```bash
git add .
git commit -m "Prepare shared schedule app for deployment"
```

## 4. GitHub 저장소 만들기

1. GitHub에 로그인합니다.
2. 오른쪽 위 `+` 버튼을 누릅니다.
3. `New repository`를 선택합니다.
4. Repository name을 입력합니다. 예: `shared-schedule`
5. Public 또는 Private을 선택합니다.
6. `Add a README file`은 체크하지 않습니다.
7. `Create repository`를 누릅니다.

GitHub가 보여주는 원격 저장소 주소를 복사한 뒤 로컬에서 연결합니다.

```bash
git remote add origin https://github.com/YOUR_NAME/shared-schedule.git
git branch -M main
git push -u origin main
```

## 5. Supabase 마이그레이션 적용

Vercel 배포 전에 운영 Supabase 데이터베이스에 마이그레이션을 적용합니다.

```bash
supabase db push
```

적용되어야 하는 마이그레이션:

- `20260702013000_shared_schedule_schema.sql`
- `20260703090000_fix_room_creation_rpc.sql`

Supabase Dashboard의 Table Editor에서 아래 테이블이 보이면 기본 구조가 적용된 것입니다.

- `profiles`
- `scheduling_rooms`
- `room_members`
- `room_invites`
- `schedules`
- `schedule_participants`
- `schedule_user_states`
- `preliminary_tasks`
- `user_preferences`

## 6. Supabase Auth 설정

Supabase Dashboard에서 설정합니다.

1. Supabase 프로젝트로 이동합니다.
2. `Authentication` 메뉴로 이동합니다.
3. `URL Configuration`을 엽니다.
4. `Site URL`에 Vercel 배포 주소를 넣습니다.
   - 예: `https://shared-schedule.vercel.app`
5. `Redirect URLs`에 아래 값을 추가합니다.
   - `https://shared-schedule.vercel.app/**`
   - Preview 배포를 사용할 경우 `https://*.vercel.app/**`

## 7. Vercel 프로젝트 연결

1. Vercel에 로그인합니다.
2. `Add New...` 버튼을 누릅니다.
3. `Project`를 선택합니다.
4. GitHub 저장소를 선택합니다.
5. Framework Preset이 `Next.js`인지 확인합니다.
6. Build Command는 기본값 또는 아래 값으로 둡니다.

```bash
npm run build
```

7. Install Command는 기본값 또는 아래 값으로 둡니다.

```bash
npm install
```

## 8. Vercel 환경 변수 설정

Vercel 프로젝트의 `Settings > Environment Variables`에서 아래 값을 추가합니다.

필수:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://YOUR_PROJECT.vercel.app
```

필요할 때만 추가:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
```

주의:

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`는 서버 전용입니다.
- 두 키에는 절대 `NEXT_PUBLIC_`을 붙이지 마세요.
- `SUPABASE_DATABASE_PASSWORD`는 앱 런타임에는 필요하지 않습니다.

## 9. 초기 서비스 관리자 생성

초기 관리자는 로컬에서 한 번 생성하는 것을 권장합니다. Vercel 런타임 환경 변수에 초기 관리자 비밀번호를 오래 보관하지 마세요.

```bash
INITIAL_ADMIN_ID=your-admin-id INITIAL_ADMIN_PASSWORD='StrongPassword123!' INITIAL_ADMIN_NAME='관리자' npm run admin:create-initial
```

생성 후에는 `.env.local`에서 `INITIAL_ADMIN_PASSWORD`를 제거하거나 빈 값으로 돌려두세요.

## 10. Vercel 배포

환경 변수를 모두 입력한 뒤 `Deploy`를 누릅니다.

배포가 끝나면 Vercel이 제공한 주소로 접속합니다.

## 11. 배포 후 확인

아래 순서대로 실제 기능을 확인합니다.

1. 로그인 페이지가 열리는지 확인합니다.
2. 초기 서비스 관리자 계정으로 로그인합니다.
3. `/dashboard`로 이동하는지 확인합니다.
4. 새 방 만들기를 실행합니다.
5. Supabase Table Editor에서 `scheduling_rooms`, `room_members`, `room_invites`에 데이터가 생겼는지 확인합니다.
6. 방 달력에서 일정을 추가합니다.
7. Supabase Table Editor에서 `schedules`, `schedule_participants`에 데이터가 생겼는지 확인합니다.
8. 관리자 페이지에서 사용자 생성 화면이 열리는지 확인합니다.
9. 일반 사용자로 로그인했을 때 `/admin` 접근이 막히는지 확인합니다.
10. Vercel `Runtime Logs`에 오류가 없는지 확인합니다.

## 12. 운영 전 보안 체크

운영 전에 [SECURITY.md](./SECURITY.md)를 읽고 아래 항목을 확인하세요.

- 서비스 role key가 Git에 올라가지 않았는지 확인
- 초기 관리자 비밀번호를 강한 비밀번호로 변경
- Supabase RLS가 활성화되어 있는지 확인
- 관리자 API 접근이 서비스 관리자에게만 허용되는지 확인
- 불필요한 테스트 계정과 테스트 데이터 삭제
