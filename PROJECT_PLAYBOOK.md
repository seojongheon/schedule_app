# 공유 스케줄 프로젝트 플레이북

이 문서는 저장소 운영, 배포, 데이터베이스 적용, 보안 점검, 장애 대응에 필요한 공통 기준과 실행 순서를 관리하는 단일 플레이북입니다. compound 기록도 이 문서에서만 관리합니다.

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
PRIVATE_DATA_ACTIVE_KEY_VERSION=1
PRIVATE_DATA_KEY_V1=
SECURITY_HMAC_KEY=
DELETION_HMAC_KEY=
TRUSTED_PROXY_MODE=vercel
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

## 13. Compound 기록 관리

프로젝트에서 발견한 운영 지식, 장애 원인, 확정된 방향, 검증 결과는 이 문서에만 추가합니다. 별도의 compound 문서나 기능별 복사본을 만들지 않습니다.

각 기록은 다음 순서를 유지합니다.

1. 날짜와 대상 범위
2. 증상과 영향
3. 확인한 근거
4. 확정한 원인과 결정
5. 적용한 변경 또는 운영 조치
6. 검증 결과와 남은 후속 작업

문서 본문은 중립적인 기술 문체로 작성하고, 비밀번호·토큰·암호화 키·개인정보·원문 IP는 기록하지 않습니다.

### 2026-07-20 — MVP 워크스페이스 성능 최적화

1. 날짜와 대상 범위
   - 대상: 인증된 대시보드·오늘 일정·예비 할 일·방 목록·방 상세·마이페이지의 초기 로딩과 반복 수정 동작
2. 증상과 영향
   - 화면별 필요 범위를 초과한 일정·참여자·상태·작업 조회가 반복되었고, 수정 성공 후에도 전체 라우트 새로고침과 광범위한 재검증이 발생했습니다.
   - 한국 리전 전환 후 네트워크 지연은 줄었지만, 불필요한 왕복과 응답 데이터가 남아 있었습니다.
3. 확인한 근거
   - 기존 공통 로더가 모든 화면에서 와일드카드 컬럼과 전체 일정 집합을 요청했습니다.
   - 클라이언트 컴포넌트에 전체 새로고침 호출이 16개 존재했고, 서버 액션은 여러 워크스페이스 경로를 동시에 무효화했습니다.
   - 변경 후 단위 테스트 171건, ESLint, TypeScript 검사, Next.js 프로덕션 빌드가 모두 통과했습니다.
4. 확정한 원인과 결정
   - MVP 범위에서는 캐시나 인프라 증설보다 조회 범위 축소, 불필요한 왕복 제거, 공개 경로 인증 작업 우회가 우선 효과가 크다고 결정했습니다.
   - DB 스키마·인덱스·마이그레이션·데이터는 변경하지 않았습니다.
5. 적용한 변경 또는 운영 조치
   - 성공한 낙관적 수정은 로컬 상태로 완료하고 전체 `router.refresh()`와 광범위한 경로 재검증을 제거했습니다.
   - 화면별 조회 계획과 명시적 컬럼 목록을 도입하고, 오늘 일정은 한국 표준시 경계로 제한했습니다.
   - 보호 경로는 검증된 JWT claim을 사용하고 공개 경로는 Supabase 인증 클라이언트 생성을 건너뛰도록 변경했습니다.
   - 변경 사항은 `main`에 반영하고 원격 저장소에 푸시했습니다.
6. 검증 결과와 남은 후속 작업
   - 사용자가 실제 체감 속도 향상을 확인했습니다.
   - 다음 배포 때 Vercel 로그와 실제 로그인 후 주요 화면을 한 번 확인하고, 필요하면 동일 조건의 전후 응답 시간을 기록합니다.

### 2026-07-20 — 방 역할별 일정 소유권 및 초대 링크 복구

1. 날짜와 대상 범위
   - 대상: 방장·매니저·구성원·보기 전용의 일정 생성·수정·삭제, 구성원 강퇴, 초대 링크 생성·교체·회수
2. 증상과 영향
   - 구성원은 자신의 일정을 만들 수 없었고, 방장과 매니저 사이의 일정 권한 차등 및 일정 소유자 표시가 없었습니다.
   - 정상적인 초대 링크 생성·교체·회수 이벤트가 `invitation_attempts` 제약에 허용되지 않아 성공 트랜잭션이 롤백될 수 있었습니다.
3. 확인한 근거
   - 화면은 일정 관리 가능 여부를 방장·매니저 여부만으로 판단했고, 일정 테이블에는 실제 소유자와 탈퇴 후에도 보존할 이름 스냅샷이 없었습니다.
   - 초대 저장소가 기록하는 `create`, `replace`, `revoke` 값과 DB 체크 제약의 허용 값이 일치하지 않았습니다.
4. 확정한 원인과 결정
   - 일정의 실제 소유자를 `owner_member_id`로 분리하고 표시용 소유자·등록자 이름은 스냅샷으로 보존합니다.
   - 구성원은 본인 소유 일정만 생성·수정·삭제하고, 방장과 매니저는 보기 전용을 제외한 구성원에게 일정을 생성할 수 있습니다.
   - 방장과 매니저는 일반 구성원 소유 일정만 추가 삭제할 수 있으며 서로 또는 다른 방장·매니저의 일정은 삭제할 수 없습니다. 구성원 관리와 강퇴는 방장에게만 허용합니다.
5. 적용한 변경 또는 운영 조치
   - `20260720190000_add_schedule_ownership_permissions.sql`을 실제 운영 Supabase DB에 적용했습니다.
   - 일정 저장·삭제·상태 변경과 구성원 강퇴를 권한 검증이 포함된 원자적 RPC로 전환하고 직접 테이블 쓰기 권한을 회수했습니다.
   - 강퇴된 구성원의 일정은 실제 소유권만 방장에게 이전하고 기존 소유자 이름은 유지하도록 했습니다.
   - 초대 이벤트 제약에 `create`, `replace`, `revoke`를 추가해 방장·매니저의 초대 링크 작업이 롤백되지 않도록 했습니다.
6. 검증 결과와 남은 후속 작업
   - 원격 마이그레이션 이력에서 로컬·원격 버전이 일치하고 `db push --dry-run` 결과 추가 적용 대상이 없음을 확인했습니다.
   - 권한·SQL·초대 계약 테스트, TypeScript 검사, ESLint 및 프로덕션 빌드를 통과시킨 뒤 배포합니다.
   - 배포 후 실제 방에서 구성원 본인 일정, 매니저 대리 생성, 동급 일정 삭제 차단, 방장 강퇴와 이름 유지, 방장·매니저 초대 링크 생성을 순서대로 확인합니다.

### 2026-07-20 — 일간 시간표 동시 일정 배치

1. 날짜와 대상 범위
   - 대상: 방 상세 일간 시간표의 일정 박스 배치, 참여자 필터, 다중 겹침 더보기 목록
2. 증상과 영향
   - 같은 시간대 일정이 고정된 좌우 위치와 최소 크기를 사용해 서로 겹치거나, 실제 등록 순서와 무관한 위치에 표시되었습니다.
   - 일정이 연속해서 이어지기만 해도 같은 겹침 묶음처럼 취급하면 불필요한 축약이 발생할 수 있었습니다.
3. 확인한 근거
   - 기존 화면은 배열 인덱스의 홀짝으로 박스의 좌우 위치를 정하고 최소 너비와 최소 높이를 강제했습니다.
   - 일정 읽기 모델에 실제 생성 시각이 없어 등록 순서 기준 배치를 계산할 수 없었습니다.
4. 확정한 원인과 결정
   - 모든 시작·종료 시각을 경계로 나누고 각 시간 구간에서 실제 동시 활성 일정만 다시 계산합니다.
   - 같은 구간에서는 `created_at`이 빠른 일정을 왼쪽에 두고, 늦게 등록된 일정을 오른쪽에 둡니다.
   - 동시에 활성인 일정이 5개 이상인 구간만 오래된 일정 3개와 `더보기` 1열로 축약하며, 단순히 이어진 일정은 축약하지 않습니다.
5. 적용한 변경 또는 운영 조치
   - 일정 읽기 모델에 `createdAt`을 추가하고 조회 컬럼과 낙관적 생성 데이터에 반영했습니다.
   - 시간 경계별 가변 열 계산기를 추가해 겹침이 시작되면 기존 박스를 줄이고 끝나면 다시 넓히도록 했습니다.
   - 더보기에는 해당 혼잡 구간의 전체 일정 제목·시간·참여자를 표시하고, 항목을 선택하면 기존 일정 상세를 열도록 연결했습니다.
   - 선택한 구성원의 일정이 숨겨진 경우 더보기 버튼을 해당 구성원 색상과 강조선으로 표시합니다.
6. 검증 결과와 남은 후속 작업
   - 등록 순서, 정확한 종료·시작 경계, 부분 겹침의 축소·확장, 5개 동시 겹침, 최대 동시 2개인 연쇄 일정에 대한 자동 테스트를 추가했습니다.
   - 배포 후 실제 방에서 모바일 너비로 4개·5개 동시 일정과 참여자 필터의 더보기 강조를 확인합니다.
