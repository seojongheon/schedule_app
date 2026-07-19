# Supabase Region Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Supabase 프로젝트의 스키마, Auth 사용자·비밀번호 해시, 권한 및 모든 업무 데이터를 새 리전 프로젝트로 안전하게 이전하고 슈퍼관리자 재로그인과 롤백 가능성을 검증한다.

**Architecture:** 기존 프로젝트에서 역할·스키마·데이터·마이그레이션 이력을 논리 백업하고, 트리거를 억제한 단일 트랜잭션으로 비어 있는 새 프로젝트에 복원한다. 복원 후 DB 무결성과 보안 정책을 검증한 다음 Auth 설정 및 배포 환경 변수를 한 번에 전환하며, 기존 프로젝트는 7일간 롤백 원본으로 보존한다.

**Tech Stack:** Supabase CLI, PostgreSQL `psql`, Docker Desktop, Next.js 15, Supabase Auth, PostgreSQL RLS, Vercel

## Global Constraints

- Supabase Storage 객체는 이전 대상이 아니다.
- 실제 Auth 사용자는 이메일/비밀번호 방식의 슈퍼관리자 한 명이다.
- 이전 시작 시점의 스냅샷만 보존하며 증분 또는 실시간 동기화는 하지 않는다.
- 기존 JWT 비밀키는 복사하지 않고 이전 후 재로그인을 요구한다.
- `auth.users.id`, `profiles.id`, `service_role_assignments.user_id`는 변경하지 않는다.
- 새 프로젝트에는 복원 전에 `supabase db push`를 실행하지 않는다.
- `PRIVATE_DATA_KEY_V1`, `SECURITY_HMAC_KEY`, `DELETION_HMAC_KEY` 등 애플리케이션 비밀키는 기존 값을 유지한다.
- DB URL, 비밀번호, API 키, 사용자 이메일, 백업 파일은 Git이나 운영 문서에 기록하지 않는다.
- 새 프로젝트에 중요한 신규 데이터를 입력하지 않은 상태에서만 기존 프로젝트로 단순 롤백한다.
- 공식 기준 문서는 [CLI 백업·복원](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Auth 사용자 이전](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects), [프로젝트 복원 범위](https://supabase.com/docs/guides/platform/clone-project)다.

---

## File and Artifact Map

- Existing source migrations: `supabase/migrations/*.sql` — 복원 후 마이그레이션 이력과 비교할 기준
- Existing security test: `supabase/tests/commercial_readiness_security.sql` — 대상 DB의 RLS·보안 함수 검증
- Existing deployment guide: `PROJECT_PLAYBOOK.md` — 배포 환경 변수와 기능 확인 기준
- Runtime-only backup directory: `/private/tmp/supabase-region-migration.*` — Git 밖에 생성하는 제한된 임시 디렉터리
- Runtime-only artifacts: `roles.sql`, `schema.sql`, `data.sql`, `history_schema.sql`, `history_data.sql`, `source-counts.txt`, `target-counts.txt`, `restore.log`, `SHA256SUMS`
- Design reference: `docs/superpowers/specs/2026-07-20-supabase-region-migration-design.md`
- Plan: `docs/superpowers/plans/2026-07-20-supabase-region-migration.md`

---

### Task 1: 도구 설치와 프로젝트 식별

**Files:**
- Inspect: `supabase/migrations/*.sql`
- Runtime create: `/private/tmp/supabase-region-migration.*`

**Interfaces:**
- Consumes: Supabase Dashboard에서 확인한 기존/신규 Project Ref와 Session pooler 연결 문자열
- Produces: 검증된 CLI 도구와 권한이 제한된 `$MIGRATION_DIR`

- [ ] **Step 1: Homebrew와 필수 도구 존재 여부 확인**

Run:

```zsh
cd /Users/seojongheon/Desktop/scheduling
command -v brew
command -v supabase || true
command -v psql || true
command -v docker || true
```

Expected: `brew` 경로가 출력된다. 현재 워크스페이스 사전 점검에서는 `supabase`, `psql`, `docker`가 발견되지 않았으므로 다음 단계를 실행한다.

- [ ] **Step 2: Supabase CLI, PostgreSQL 클라이언트와 Docker Desktop 설치**

Run:

```zsh
brew install supabase/tap/supabase libpq
brew install --cask docker-desktop
export PATH="$(brew --prefix libpq)/bin:$PATH"
open -a Docker
```

Expected: Homebrew 설치가 성공하고 Docker Desktop이 실행된다. Docker가 시작될 때까지 다음 확인 명령이 성공하지 않으면 진행하지 않는다.

- [ ] **Step 3: 도구 버전과 Docker 상태 확인**

Run:

```zsh
supabase --version
psql --version
docker version
```

Expected: 세 명령이 모두 종료 코드 `0`을 반환하고, `docker version`에 Client와 Server가 모두 표시된다.

- [ ] **Step 4: Supabase CLI 로그인과 프로젝트 목록 확인**

Run:

```zsh
supabase login
supabase projects list
```

Expected: 기존 프로젝트와 새 프로젝트가 서로 다른 Project Ref와 의도한 기존/신규 리전으로 표시된다. Project Ref가 불분명하면 중단한다.

- [ ] **Step 5: 현재 셸에 비밀값을 숨김 입력으로 로드**

Supabase Dashboard의 각 프로젝트 `Connect` 화면에서 Session pooler 연결 문자열을 복사한다. 문자열의 비밀번호 자리에는 URL 인코딩된 실제 DB 비밀번호가 들어 있어야 한다. 아래 입력 내용은 화면에 표시되지 않는다.

Run:

```zsh
read -r 'OLD_PROJECT_REF?기존 Project Ref: '
read -r 'NEW_PROJECT_REF?신규 Project Ref: '
read -rs 'OLD_DB_URL?기존 Session pooler DB URL: '; echo
read -rs 'NEW_DB_URL?신규 Session pooler DB URL: '; echo
MIGRATION_DIR="$(mktemp -d /private/tmp/supabase-region-migration.XXXXXX)"
chmod 700 "$MIGRATION_DIR"
export OLD_PROJECT_REF NEW_PROJECT_REF OLD_DB_URL NEW_DB_URL MIGRATION_DIR
test "$OLD_PROJECT_REF" != "$NEW_PROJECT_REF"
stat -f '%Sp %N' "$MIGRATION_DIR"
```

Expected: 마지막 `test`가 성공하고 임시 디렉터리 권한이 `drwx------`로 표시된다. 이 터미널 창은 전환이 끝날 때까지 유지한다.

- [ ] **Step 6: 연결 대상을 읽기 전용 쿼리로 검증**

Run:

```zsh
psql "$OLD_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "select 'source', current_database(), current_user, current_setting('server_version');"
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "select 'target', current_database(), current_user, current_setting('server_version');"
```

Expected: 첫 줄은 `source`, 둘째 줄은 `target`으로 시작하고 두 연결 모두 성공한다. 두 프로젝트의 Dashboard `Connect` 화면과 입력한 URL을 다시 대조한 뒤에만 진행한다.

---

### Task 2: 소스 기준선과 복원 가능성 검증

**Files:**
- Create: `$MIGRATION_DIR/source-counts.txt`
- Create: `$MIGRATION_DIR/source-admin.txt`
- Inspect: `supabase/migrations/*.sql`

**Interfaces:**
- Consumes: `$OLD_DB_URL`, `$NEW_DB_URL`, `$MIGRATION_DIR`
- Produces: 소스 기준 행 수, 비식별 관리자 무결성 기록, 비어 있는 대상 확인

- [ ] **Step 1: 로컬 애플리케이션 검증 실행**

Run:

```zsh
cd /Users/seojongheon/Desktop/scheduling
npm run test:security
npm run predeploy:check
```

Expected: 두 명령이 종료 코드 `0`으로 끝난다. 실패하면 DB 이전 전에 애플리케이션 문제를 먼저 해결한다.

- [ ] **Step 2: 새 프로젝트가 비어 있는지 확인**

Run:

```zsh
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
select count(*) as auth_user_count from auth.users;
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;
SQL
```

Expected: `auth_user_count`가 `0`이고 `public` 사용자 테이블이 출력되지 않는다. 행 또는 테이블이 존재하면 복원을 중단하고 대상 프로젝트를 비우거나 새 프로젝트를 다시 만든다. 운영자가 내용을 확인하지 않은 채 `supabase db reset --linked`를 실행하지 않는다.

- [ ] **Step 3: 소스의 public 테이블과 Auth 사용자 행 수 저장**

Run:

```zsh
psql "$OLD_DB_URL" -X -v ON_ERROR_STOP=1 > "$MIGRATION_DIR/source-counts.txt" <<'SQL'
\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'
select format(
  'select %L, count(*) from %I.%I;',
  schemaname || '.' || tablename,
  schemaname,
  tablename
)
from pg_tables
where schemaname = 'public'
order by tablename
\gexec
select 'auth.users', count(*) from auth.users;
SQL
sed -n '1,120p' "$MIGRATION_DIR/source-counts.txt"
```

Expected: 각 `public.<table>|<count>` 행과 `auth.users|1`이 출력된다. `auth.users`가 `1`이 아니면 실제 사용자 범위를 다시 확인하고 중단한다.

- [ ] **Step 4: 이메일을 노출하지 않고 슈퍼관리자 관계를 기록**

Run:

```zsh
psql "$OLD_DB_URL" -X -v ON_ERROR_STOP=1 -AtF '|' > "$MIGRATION_DIR/source-admin.txt" <<'SQL'
select
  u.id,
  md5(coalesce(lower(u.email), '')) as email_fingerprint,
  (coalesce(u.encrypted_password, '') <> '') as has_password_hash,
  p.id = u.id as profile_matches,
  p.account_state,
  count(sra.id) filter (where sra.role = 'super_admin' and sra.revoked_at is null) as active_super_admin_roles
from auth.users u
join public.profiles p on p.id = u.id
left join public.service_role_assignments sra on sra.user_id = u.id
group by u.id, u.email, u.encrypted_password, p.id, p.account_state
order by u.id;
SQL
cat "$MIGRATION_DIR/source-admin.txt"
```

Expected: 한 줄이 출력되고 `has_password_hash`, `profile_matches`가 `t`, `account_state`가 `active`, 마지막 값이 `1` 이상이다. 원본 UUID는 개인 로그인 정보가 아닌 관계 검증용 식별자로 임시 디렉터리에만 보관한다.

- [ ] **Step 5: 소스 확장 기능과 마이그레이션 버전 확인**

Run:

```zsh
psql "$OLD_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "select extname from pg_extension where extname = 'pgcrypto';"
printf '%s\n' supabase/migrations/*.sql | sed -E 's#.*/([0-9]+)_.*#\1#'
```

Expected: `pgcrypto`가 출력되고 로컬 마이그레이션 버전은 `20260702013000`, `20260703090000`, `20260703140000`, `20260718120000`이다.

---

### Task 3: 소스 전체 논리 백업

**Files:**
- Create: `$MIGRATION_DIR/roles.sql`
- Create: `$MIGRATION_DIR/schema.sql`
- Create: `$MIGRATION_DIR/data.sql`
- Create: `$MIGRATION_DIR/history_schema.sql`
- Create: `$MIGRATION_DIR/history_data.sql`
- Create: `$MIGRATION_DIR/SHA256SUMS`

**Interfaces:**
- Consumes: 검증된 `$OLD_DB_URL`
- Produces: 새 프로젝트에 복원 가능한 전체 논리 백업과 무결성 체크섬

- [ ] **Step 1: 역할, 스키마와 데이터 백업 생성**

Run:

```zsh
supabase db dump --db-url "$OLD_DB_URL" -f "$MIGRATION_DIR/roles.sql" --role-only
supabase db dump --db-url "$OLD_DB_URL" -f "$MIGRATION_DIR/schema.sql"
supabase db dump --db-url "$OLD_DB_URL" -f "$MIGRATION_DIR/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Expected: 세 명령이 모두 종료 코드 `0`으로 끝난다. `data.sql`에는 `auth.users` 및 public 데이터의 `COPY` 또는 삽입 구문이 포함된다.

- [ ] **Step 2: Supabase 마이그레이션 이력 별도 백업**

Run:

```zsh
supabase db dump --db-url "$OLD_DB_URL" -f "$MIGRATION_DIR/history_schema.sql" --schema supabase_migrations
supabase db dump --db-url "$OLD_DB_URL" -f "$MIGRATION_DIR/history_data.sql" --use-copy --data-only --schema supabase_migrations
```

Expected: 두 파일이 생성되고 `history_data.sql`에 로컬 마이그레이션 네 버전이 포함된다.

- [ ] **Step 3: 백업 파일 내용과 권한 확인**

Run:

```zsh
chmod 600 "$MIGRATION_DIR"/*.sql "$MIGRATION_DIR"/*.txt
ls -lh "$MIGRATION_DIR"
test -s "$MIGRATION_DIR/roles.sql"
test -s "$MIGRATION_DIR/schema.sql"
test -s "$MIGRATION_DIR/data.sql"
test -s "$MIGRATION_DIR/history_schema.sql"
test -s "$MIGRATION_DIR/history_data.sql"
rg -n -m 1 'auth\.users|COPY auth\.users' "$MIGRATION_DIR/data.sql"
rg -n -m 1 'public\.profiles|COPY public\.profiles' "$MIGRATION_DIR/data.sql"
rg -n '20260702013000|20260703090000|20260703140000|20260718120000' "$MIGRATION_DIR/history_data.sql"
```

Expected: 모든 `test -s`가 성공하고 Auth 사용자, 프로필, 네 마이그레이션 버전이 검색된다. 검색에 실패하면 복원을 시작하지 않는다.

- [ ] **Step 4: 체크섬 생성과 즉시 재검증**

Run:

```zsh
cd "$MIGRATION_DIR"
shasum -a 256 roles.sql schema.sql data.sql history_schema.sql history_data.sql > SHA256SUMS
chmod 600 SHA256SUMS
shasum -a 256 -c SHA256SUMS
cd /Users/seojongheon/Desktop/scheduling
```

Expected: 다섯 파일 모두 `OK`로 표시된다.

---

### Task 4: 새 프로젝트 원자적 복원

**Files:**
- Read: `$MIGRATION_DIR/roles.sql`
- Read: `$MIGRATION_DIR/schema.sql`
- Read: `$MIGRATION_DIR/data.sql`
- Create: `$MIGRATION_DIR/restore.log`

**Interfaces:**
- Consumes: 검증된 백업과 `$NEW_DB_URL`
- Produces: 역할·스키마·Auth·업무 데이터가 복원된 새 프로젝트

- [ ] **Step 1: 복원 직전 대상과 백업을 다시 확인**

Run:

```zsh
test "$OLD_PROJECT_REF" != "$NEW_PROJECT_REF"
cd "$MIGRATION_DIR"
shasum -a 256 -c SHA256SUMS
cd /Users/seojongheon/Desktop/scheduling
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 -Atc "select count(*) from auth.users;"
```

Expected: 체크섬이 모두 `OK`이고 대상 `auth.users` 수가 `0`이다.

- [ ] **Step 2: 역할·스키마·데이터를 한 트랜잭션으로 복원**

Run:

```zsh
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$MIGRATION_DIR/roles.sql" \
  --file "$MIGRATION_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$MIGRATION_DIR/data.sql" \
  --dbname "$NEW_DB_URL" \
  > "$MIGRATION_DIR/restore.log" 2>&1
RESTORE_STATUS=$?
tail -n 60 "$MIGRATION_DIR/restore.log"
test "$RESTORE_STATUS" -eq 0
```

Expected: 마지막 `test`가 성공한다. 실패하면 단일 트랜잭션이 롤백되므로 후속 단계를 실행하지 말고 `restore.log`의 첫 오류를 해결한다. 비밀번호, 토큰 또는 전체 로그를 채팅·이슈에 붙여 넣지 않는다.

- [ ] **Step 3: 마이그레이션 이력 복원**

Run:

```zsh
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$MIGRATION_DIR/history_schema.sql" \
  --file "$MIGRATION_DIR/history_data.sql" \
  --dbname "$NEW_DB_URL"
```

Expected: 종료 코드 `0`. `supabase_migrations.schema_migrations`가 생성되고 네 로컬 버전이 기록된다.

- [ ] **Step 4: 복원 직후 외부 실행 기능이 없는지 확인**

Run:

```zsh
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
select extname
from pg_extension
where extname in ('pg_net', 'pg_cron', 'wrappers')
order by extname;
SQL
```

Expected: 현재 저장소 기준으로 행이 출력되지 않는다. 출력되면 해당 확장 기능의 예약 작업·웹훅이 기존 외부 시스템을 호출하지 않는지 확인할 때까지 배포하지 않는다.

---

### Task 5: 데이터, Auth와 보안 무결성 검증

**Files:**
- Create: `$MIGRATION_DIR/target-counts.txt`
- Create: `$MIGRATION_DIR/target-admin.txt`
- Read: `supabase/tests/commercial_readiness_security.sql`

**Interfaces:**
- Consumes: 복원된 `$NEW_DB_URL`, 소스 기준선 파일
- Produces: 행 수·사용자 관계·RLS·함수·마이그레이션 이력 검증 증거

- [ ] **Step 1: 대상 행 수 생성 후 소스와 비교**

Run:

```zsh
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 > "$MIGRATION_DIR/target-counts.txt" <<'SQL'
\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'
select format(
  'select %L, count(*) from %I.%I;',
  schemaname || '.' || tablename,
  schemaname,
  tablename
)
from pg_tables
where schemaname = 'public'
order by tablename
\gexec
select 'auth.users', count(*) from auth.users;
SQL
diff -u "$MIGRATION_DIR/source-counts.txt" "$MIGRATION_DIR/target-counts.txt"
```

Expected: `diff` 출력이 없고 종료 코드가 `0`이다.

- [ ] **Step 2: 대상 슈퍼관리자 관계를 소스와 비교**

Run:

```zsh
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 -AtF '|' > "$MIGRATION_DIR/target-admin.txt" <<'SQL'
select
  u.id,
  md5(coalesce(lower(u.email), '')) as email_fingerprint,
  (coalesce(u.encrypted_password, '') <> '') as has_password_hash,
  p.id = u.id as profile_matches,
  p.account_state,
  count(sra.id) filter (where sra.role = 'super_admin' and sra.revoked_at is null) as active_super_admin_roles
from auth.users u
join public.profiles p on p.id = u.id
left join public.service_role_assignments sra on sra.user_id = u.id
group by u.id, u.email, u.encrypted_password, p.id, p.account_state
order by u.id;
SQL
diff -u "$MIGRATION_DIR/source-admin.txt" "$MIGRATION_DIR/target-admin.txt"
```

Expected: `diff` 출력이 없고 종료 코드가 `0`이다.

- [ ] **Step 3: 외래키 위반과 RLS 비활성 테이블 확인**

Run:

```zsh
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
select c.conrelid::regclass as table_name, c.conname
from pg_constraint c
where c.contype = 'f'
  and c.connamespace = 'public'::regnamespace
  and not c.convalidated;

select n.nspname, c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;
SQL
```

Expected: 첫 쿼리는 행이 없다. 두 번째 쿼리의 결과는 마이그레이션에서 의도적으로 RLS를 사용하지 않는 테이블이 있는 경우에만 허용하며, 임의로 판단하지 않고 `supabase/migrations` 정의와 대조한다.

- [ ] **Step 4: 저장소의 보안 SQL을 대상 DB에서 트랜잭션 검증**

Run:

```zsh
cd /Users/seojongheon/Desktop/scheduling
psql "$NEW_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/commercial_readiness_security.sql
```

Expected: 모든 `assert`가 통과하고 마지막에 `ROLLBACK`이 표시된다. 이 SQL은 자체 트랜잭션에서 검증 후 롤백한다.

- [ ] **Step 5: 마이그레이션 이력 비교와 dry-run 확인**

Run:

```zsh
supabase migration list --db-url "$NEW_DB_URL"
supabase db push --db-url "$NEW_DB_URL" --dry-run
```

Expected: 네 마이그레이션 버전이 local/remote 양쪽에 정렬되고 dry-run 결과가 대상 DB가 최신 상태임을 나타낸다. 적용 예정 마이그레이션이 보이면 실제 `db push`를 실행하지 않고 이력 복원 문제를 해결한다.

---

### Task 6: Auth 설정과 배포 환경 변수 전환

**Files:**
- Inspect: `.env.example`
- Inspect: `PROJECT_PLAYBOOK.md`
- Modify outside repository: Supabase Dashboard Auth 설정과 Vercel Environment Variables

**Interfaces:**
- Consumes: 새 Project URL, publishable key, secret key, 기존 애플리케이션 암호화/HMAC 키
- Produces: 새 프로젝트만 가리키는 일관된 배포 환경과 이메일/비밀번호 Auth 설정

- [ ] **Step 1: 새 Supabase Auth 설정을 기존 프로젝트와 항목별 일치**

Dashboard에서 기존 프로젝트와 신규 프로젝트를 나란히 확인하여 다음 값을 동일하게 설정한다.

```text
Authentication > Providers > Email: enabled
Authentication > URL Configuration > Site URL: 현재 NEXT_PUBLIC_SITE_URL
Authentication > URL Configuration > Redirect URLs: 현재 운영·허용 도메인
Authentication > Settings: 회원가입 허용 여부
Authentication > Settings: 이메일 확인 정책
Authentication > Settings: 비밀번호 최소 길이와 문자 정책
Authentication > Sessions: JWT 만료, 세션 수명, 비활성 시간, 단일 세션 정책
Authentication > Email: SMTP와 템플릿(기존 프로젝트에서 사용 중인 경우)
Authentication > Providers: Google/Kakao/Naver disabled
```

Expected: 차이가 모두 해소된다. 기존 JWT 비밀키 또는 signing key는 새 프로젝트로 복사하지 않는다.

- [ ] **Step 2: 새 프로젝트 API 키 확인**

Dashboard의 `Settings > API Keys`에서 다음 두 값을 비밀 관리자에 저장한다.

```text
NEXT_PUBLIC_SUPABASE_URL = 새 프로젝트 URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 새 publishable key
SUPABASE_SECRET_KEY = 새 secret key
```

Expected: URL과 두 키가 모두 같은 신규 Project Ref에 속한다. 기존 `SUPABASE_SERVICE_ROLE_KEY`를 계속 사용할 이유가 없다면 신규 배포에서는 제거하고 `SUPABASE_SECRET_KEY`만 사용한다. 키 값을 로컬 문서나 Git에 붙여 넣지 않는다.

- [ ] **Step 3: 애플리케이션 비밀키 보존 확인**

Vercel 기존 Production 환경에서 다음 이름의 값이 유지되는지 이름과 버전만 확인한다. 실제 값은 화면 밖으로 복사하거나 기록하지 않는다.

```text
PRIVATE_DATA_ACTIVE_KEY_VERSION
PRIVATE_DATA_KEY_V1
SECURITY_HMAC_KEY
DELETION_HMAC_KEY
PRIVACY_MAINTENANCE_SECRET
GUARDIAN_VERIFICATION_CALLBACK_SECRET
```

Expected: 기존에 설정된 키는 값 변경 없이 유지된다. 누락된 기존 키가 있으면 암호화 데이터 검증 전까지 배포를 중단한다.

- [ ] **Step 4: Vercel Supabase 변수 세 개를 하나의 변경으로 교체**

Vercel `Settings > Environment Variables`의 Production 범위에서 다음 값을 새 프로젝트 값으로 교체한다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

기존 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있으면 코드가 이를 우선 사용하므로 반드시 제거하거나 새 프로젝트의 service-role 값으로 교체한다. `NEXT_PUBLIC_SITE_URL`과 애플리케이션 암호화/HMAC 키는 변경하지 않는다.

Expected: 공개 URL, 공개 키, 서버 비밀키가 전부 신규 Project Ref에 속하며 기존/신규 값이 혼합되어 있지 않다.

- [ ] **Step 5: 새 환경 변수로 Production 재배포**

Vercel의 마지막 정상 Production 배포에서 `Redeploy`를 실행하고 `Use existing Build Cache`를 끈다.

Expected: 빌드가 성공하고 새 Production 배포가 활성화된다. 실패하면 Production alias를 이전 정상 배포에 유지하고 데이터 검증을 다시 수행한다.

---

### Task 7: 로그인, 기능 승인과 로컬 링크 전환

**Files:**
- Modify runtime-only: `supabase/.temp/project-ref` via `supabase link`
- Inspect: `src/app/api/auth/login/route.ts`
- Inspect: `src/app/admin/page.tsx`
- Inspect: `src/app/actions/schedule-actions.ts`

**Interfaces:**
- Consumes: 새 Production 배포와 기존 슈퍼관리자 로그인 정보
- Produces: 인증·권한·핵심 기능 승인 및 향후 migration 대상의 신규 프로젝트 고정

- [ ] **Step 1: 기존 브라우저 세션 무효화 확인**

기존에 로그인돼 있던 브라우저에서 Production URL을 새로 연다.

Expected: 기존 프로젝트 세션으로 관리자·대시보드 데이터에 접근하지 못하고 로그인 화면으로 이동한다. 기존 세션이 계속 동작하면 URL/키 혼합 여부와 JWT 설정을 확인하고 중단한다.

- [ ] **Step 2: 기존 로그인 ID와 비밀번호로 새 세션 발급**

Production 로그인 화면에서 기존 슈퍼관리자 ID와 비밀번호로 로그인한다.

Expected: 비밀번호 재설정 없이 `/dashboard`로 이동하고, `/admin` 접근이 허용된다. 로그인 실패 시 `auth.users`를 새로 만들거나 `admin:create-initial`을 실행하지 말고 복원과 Auth 설정을 먼저 진단한다. 새 계정을 만들면 UUID 기반 관계가 끊어진다.

- [ ] **Step 3: 읽기 전용 기능 확인**

다음 화면을 순서대로 확인한다.

```text
/dashboard
/rooms
/admin
/support
/mypage
```

Expected: 기존 방·일정·프로필·권한 데이터가 표시되고 Vercel Runtime Logs에 401 반복, RLS 오류, 복호화 오류 또는 service-role 오류가 없다.

- [ ] **Step 4: 쓰기 기능 확인 후 테스트 데이터 정리**

`[MIGRATION-TEST]`라는 임시 방을 만들고, 일정 하나를 생성·수정·삭제한 뒤 임시 방을 삭제한다.

Expected: 모든 작업이 성공하고 삭제 후 임시 방과 일정이 UI에서 보이지 않는다. 감사 이벤트는 정상 운영 증거로 남을 수 있다. 실패하면 새 프로젝트에 더 이상 중요한 데이터를 입력하지 않고 롤백 판단으로 이동한다.

- [ ] **Step 5: 로컬 Supabase 링크를 새 프로젝트로 전환**

Run:

```zsh
cd /Users/seojongheon/Desktop/scheduling
supabase link --project-ref "$NEW_PROJECT_REF"
supabase migration list
supabase db push --dry-run
```

Expected: 링크가 신규 Project Ref를 가리키고 migration list가 일치하며 dry-run에 적용 대상이 없다. 이후 실제 `db push`는 항상 Project Ref를 다시 확인한 뒤 실행한다.

---

### Task 8: 롤백 준비, 증거 기록과 백업 폐기

**Files:**
- Modify after execution: `PROJECT_PLAYBOOK.md`의 `Compound 기록 관리` 형식에 맞춘 비식별 이전 결과
- Runtime retain: `$MIGRATION_DIR` 또는 암호화된 승인된 백업 저장소

**Interfaces:**
- Consumes: 모든 검증 결과와 기존/신규 배포 상태
- Produces: 7일 롤백 창, 비식별 운영 기록, 승인된 백업 폐기 절차

- [ ] **Step 1: 최종 승인 또는 롤백 결정**

다음 조건을 모두 만족할 때만 신규 프로젝트를 승인한다.

```text
source-counts.txt와 target-counts.txt 일치
source-admin.txt와 target-admin.txt 일치
commercial_readiness_security.sql 통과
migration list 일치 및 db push dry-run 변경 없음
기존 ID/비밀번호 로그인 성공
관리자 권한과 기존 데이터 조회 성공
방·일정 생성/수정/삭제 성공
복호화, RLS, service-role 오류 없음
```

Expected: 하나라도 실패하면 승인하지 않는다.

- [ ] **Step 2: 실패 시 기존 프로젝트로 롤백**

Vercel Production 환경 변수의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`를 보존해 둔 기존 프로젝트 값으로 한 번에 되돌리고 이전 정상 배포를 재활성화한다.

Expected: 기존 슈퍼관리자 세션 또는 재로그인으로 기존 데이터가 다시 표시된다. 신규 프로젝트에 중요한 신규 데이터가 없다는 조건 때문에 역방향 복사는 수행하지 않는다. 신규 프로젝트는 실패 분석이 끝날 때까지 삭제하지 않는다.

- [ ] **Step 3: 성공 시 기존 프로젝트와 백업의 7일 보존 설정**

기존 프로젝트에는 스키마 변경, 데이터 정리, 비밀번호 재설정 또는 삭제를 하지 않는다. 백업은 조직이 승인한 암호화 저장소로 옮기고 접근 권한을 이전 담당자에게만 제한한다. 폐기 예정일은 전환 완료 시각에서 7일 뒤로 기록한다.

Expected: 롤백 원본, 백업 위치, 담당자, 전환 완료 시각, 폐기 예정일이 비식별 운영 기록에 남는다.

- [ ] **Step 4: 비식별 Compound 기록 추가와 커밋**

`PROJECT_PLAYBOOK.md`의 마지막에 날짜, 기존/신규 리전, 실행 시간, 검증 결과, 실제 복구 목표 시간, 롤백 여부, 백업 폐기 예정일을 기록한다. Project Ref 전체값, 이메일, UUID, 키, 연결 문자열, 백업 경로는 기록하지 않는다.

Run after editing:

```zsh
cd /Users/seojongheon/Desktop/scheduling
git diff --check -- PROJECT_PLAYBOOK.md
git add PROJECT_PLAYBOOK.md
git commit -m "docs: record Supabase region migration"
```

Expected: 비식별 운영 기록만 커밋되며 비밀값이나 개인정보가 diff에 없다.

- [ ] **Step 5: 7일 후 최종 확인과 민감 백업 폐기**

7일 동안 신규 프로젝트의 로그인, RLS, 일정 작업, 오류 로그를 확인한다. 문제가 없고 별도 보존 의무가 없으면 Supabase Dashboard에서 기존 프로젝트를 삭제하기 전에 이름과 리전을 다시 확인한다. 로컬 임시 백업은 다음 명령으로 정확한 디렉터리를 확인한 후 운영자가 승인하여 삭제한다.

Run before deletion:

```zsh
printf '%s\n' "$MIGRATION_DIR"
test -n "$MIGRATION_DIR"
test "${MIGRATION_DIR#/private/tmp/supabase-region-migration.}" != "$MIGRATION_DIR"
ls -la "$MIGRATION_DIR"
```

Expected: 경로가 `/private/tmp/supabase-region-migration.`로 시작하고 삭제 대상 파일 목록이 정확히 보인다. 실제 삭제는 별도 운영 승인 후 수행하며, 삭제 후 복구할 수 없음을 기록한다.

---

## Execution Stop Conditions

다음 상황에서는 즉시 후속 단계를 중단한다.

- 기존/신규 Project Ref 또는 리전이 불분명하다.
- 대상 프로젝트에 Auth 사용자나 public 업무 테이블이 존재한다.
- 백업 파일 체크섬 또는 필수 Auth/public 데이터 검색이 실패한다.
- 복원 명령이 종료 코드 `0`이 아니다.
- 행 수, 사용자 UUID 지문, 프로필 또는 슈퍼관리자 권한이 다르다.
- 보안 SQL, migration dry-run 또는 로그인 검증이 실패한다.
- 애플리케이션 암호화 키를 기존 값으로 확보하지 못했다.
- Vercel에 기존/신규 프로젝트의 URL과 키가 혼합돼 있다.

## Expected Final State

- 새 리전 프로젝트에 기존 스키마, 업무 데이터, Auth 사용자와 비밀번호 해시가 존재한다.
- 슈퍼관리자 UUID와 권한 관계가 보존된다.
- 기존 JWT 세션은 사용할 수 없고 기존 비밀번호로 새 세션을 발급받을 수 있다.
- 애플리케이션은 새 Project URL, publishable key, secret key만 사용한다.
- 로컬 Supabase 링크와 마이그레이션 이력도 새 프로젝트를 가리킨다.
- 기존 프로젝트와 암호화 백업은 7일간 롤백 가능 상태로 보존된다.
