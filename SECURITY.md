# 보안 운영 체크리스트

## 즉시 해야 할 수동 작업

1. Supabase 키 회전
   - `.env.local`에 service role/secret key가 들어간 상태로 작업했으므로, 외부 공유 또는 커밋 가능성이 조금이라도 있으면 Supabase Dashboard에서 키를 회전하세요.
   - 회전 대상:
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_SECRET_KEY`
     - 필요 시 publishable/anon key

2. Git 추적 상태 확인
   - `.gitignore`에 `.env`, `.env.*`, `.next`, `node_modules`를 추가했습니다.
   - 이미 Git에 올라간 적이 있다면 아래 명령으로 추적에서 제거해야 합니다.
   - 값은 삭제하지 않고 Git 추적만 제거합니다.

```bash
git rm --cached .env .env.local
git rm -r --cached .next node_modules
```

3. 관리자 비밀번호 변경
   - 이전 기본 비밀번호 또는 약한 비밀번호를 사용했다면 즉시 강한 비밀번호로 변경하세요.
   - 권장 기준:
     - 12자 이상
     - 대문자, 소문자, 숫자, 특수문자 포함
     - 다른 서비스에서 재사용하지 않음

4. 환경 변수 정리
   - 브라우저에 노출 가능한 값은 `NEXT_PUBLIC_` 접두사를 사용합니다.
   - 서버 전용 값은 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
   - 권장 구성:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_DATABASE_PASSWORD=
INITIAL_ADMIN_ID=
INITIAL_ADMIN_PASSWORD=
```

## 변경된 보안 정책

- `.env`, `.env.local`, `.next`, `node_modules`는 Git 제외 대상입니다.
- 브라우저 Supabase 클라이언트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용합니다.
- 초기 관리자 생성 스크립트는 더 이상 기본 ID/비밀번호를 사용하지 않습니다.
- 초기 관리자 비밀번호는 12자 이상과 복잡도 조건을 만족해야 합니다.
- 관리자 API는 자기 자신의 관리자 권한 해제 또는 비활성화를 차단합니다.
- 마지막 활성 서비스 관리자는 해제하거나 비활성화할 수 없습니다.
- 계정 생성 중 profile 생성이 실패하면 생성된 Supabase Auth 사용자를 롤백합니다.
- 관리자는 사용자 비밀번호를 직접 설정하거나 초기화할 수 없습니다. 사용자는 본인 이메일로 복구를 시작해야 합니다.
- 관리자 읽기와 변경, 개인정보 접근, 초대 처리, 요청 제한 결정은 허용된 범위에서 감사 이벤트를 기록합니다.
- 초대 링크는 고엔트로피 토큰의 해시만 저장하고, 생성·사용·취소·재발급은 서버 전용 경계를 거칩니다.
- 일반 요청과 민감 요청은 공유 저장소 기반의 별도 제한 정책을 사용합니다.

## 남은 권장 강화 작업

1. 마이그레이션 검증
   - 폐기 가능한 PostgreSQL 환경에서 상용화 마이그레이션과 `supabase/tests/commercial_readiness_security.sql`을 먼저 실행하세요.
   - RLS, 함수 실행 권한, 초대 마지막 사용 횟수 동시성, 요청 제한 원자성을 확인한 뒤 운영 반영을 승인하세요.

2. 외부 인증 검증
   - Google, Kakao, Naver 공급자와 이메일 복구 전달을 운영 전용 테스트 계정으로 확인하세요.
   - 법정대리인 확인 공급자가 계약되기 전에는 운영 어댑터를 비활성 상태로 유지하세요.

3. 복구 훈련
   - 격리 환경에서 백업 복구, 삭제 기록 재적용, 알림 전달을 검증하고 RPO/RTO를 기록하세요.

4. 보안 헤더
   - `next.config.mjs`에서 `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` 등을 추가하세요.
