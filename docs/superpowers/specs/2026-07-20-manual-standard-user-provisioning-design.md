# 수동 일반 사용자 계정 생성 설계

## 목적

회원가입 기능이 완성되기 전까지 실제 Supabase 프로젝트에 지정된 로그인 ID의 일반 사용자 계정 하나를 안전하게 생성한다. 비밀번호와 서버 전용 키는 문서, Git, 명령 출력에 남기지 않는다.

## 대상과 계정 상태

- `.env`와 `.env.migration-new`가 공통으로 가리키는 Supabase 프로젝트를 대상으로 한다.
- 로그인 ID는 `rkdgusco`이며, 인증 저장소에서는 기존 로그인 규칙에 맞춰 `rkdgusco@shared-schedule.local`로 정규화한다.
- 표시 이름은 `rkdgusco`로 설정한다.
- 이메일 확인은 완료 상태로 만들고 프로필의 `status`와 `account_state`를 `active`로 설정한다.
- `is_service_admin`은 `false`로 유지하며 `service_role_assignments`에는 어떤 활성 역할도 추가하지 않는다.

## 실행 방식

저장소에 계정 비밀번호나 별도의 영구 시드 파일을 추가하지 않는다. 로컬에서만 실행하는 일회성 Node.js 작업이 `.env`와 `.env.migration-new`를 읽고, `.env.migration-new`의 서버 전용 Supabase 키로 Admin API를 호출한다.

작업 순서는 다음과 같다.

1. 대상 프로젝트 URL과 서버 전용 키가 설정되어 있는지 확인한다.
2. 정규화된 이메일로 기존 Auth 사용자를 검색한다.
3. 사용자가 이미 있으면 비밀번호와 프로필을 덮어쓰지 않고 실패 처리한다.
4. 사용자가 없으면 이메일 확인 완료 상태로 Auth 사용자를 생성한다.
5. 생성된 사용자 ID로 `profiles` 행을 생성하거나, 자동 생성된 행이 있다면 일반 사용자 필드만 명시적으로 설정한다.
6. Auth 사용자와 프로필을 다시 조회하고 활성 관리자 역할이 없음을 확인한다.

## 오류 처리와 보안

- Auth 사용자가 생성된 뒤 프로필 저장이 실패하면 부분 성공 상태를 명확히 보고하고 임의 삭제나 재시도는 하지 않는다.
- 기존 계정이 발견되면 자격 증명 덮어쓰기 없이 중단한다.
- 비밀번호, publishable key, secret key는 표준 출력이나 오류 메시지에 포함하지 않는다.
- 직접 SQL로 `auth.users`를 수정하지 않고 공식 Supabase Admin API를 사용한다.

## 검증

- Auth 사용자 이메일이 정규화된 값과 일치하고 이메일 확인 시각이 존재하는지 확인한다.
- `profiles.status = 'active'`, `profiles.account_state = 'active'`, `profiles.is_service_admin = false`인지 확인한다.
- 해당 사용자에게 활성 `service_role_assignments`가 0개인지 확인한다.
- 검증 결과에는 비밀값을 포함하지 않는다.

## 범위 제외

- 회원가입 화면이나 API의 구현 및 비밀번호 정책 변경
- 방, 일정, 초대 또는 샘플 데이터 생성
- 관리자 역할 부여
- 환경 변수 파일의 수정 또는 자격 증명의 Git 저장
