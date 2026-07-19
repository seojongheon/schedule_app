# Mixpanel 제품 분석 설계

## 1. 문서 목적

이 문서는 공유 스케줄 서비스에 Mixpanel 제품 분석을 도입할 때 필요한
측정 목표, 개인정보 경계, 사용자 식별 방식, 이벤트 명세, 코드 주입 위치,
리포트 구성, 오류 처리와 검증 기준을 정의한다.

이 문서는 구현 설계이며 SDK 설치나 코드 변경 자체는 포함하지 않는다.
구현자는 이 문서를 기준으로 별도의 구현 계획을 작성해야 한다.

## 2. 확정된 결정

- Mixpanel을 로그인 이후 제품 사용 분석의 기준 도구로 사용한다.
- 클라이언트와 서버를 분리한 하이브리드 수집 방식을 사용한다.
- 분석 수집은 기본적으로 비활성화한다.
- 만 14세 이상 사용자가 분석 수집에 명시적으로 동의한 이후에만 수집한다.
- 만 14세 미만 사용자는 Mixpanel 수집 대상에서 제외한다.
- Session Replay, Heatmap, Autocapture와 자동 Page View 수집은 사용하지 않는다.
- 이메일, 이름, 전화번호, 생년월일, 주소, 일정 내용과 기타 사용자 생성
  콘텐츠를 Mixpanel에 전송하지 않는다.
- 실제 사용자, 방, 일정, 구성원, 초대와 문의의 데이터베이스 ID를 이벤트
  속성으로 전송하지 않는다.
- 제품 기능 실패와 예외 분석은 Mixpanel이 아니라 Sentry가 담당한다.
- 분석 전송 실패는 원래의 사용자 작업을 실패시키지 않는다.

## 3. 목표와 비목표

### 목표

- 가입한 사용자가 방을 만들거나 초대로 방에 참여하는지 파악한다.
- 사용자가 첫 일정을 만들기까지의 활성화 퍼널을 측정한다.
- 일정 생성 이후 확인 또는 완료까지 이어지는지 측정한다.
- 일정 관련 핵심 행동의 주간 재사용률을 측정한다.
- 초대 기능이 실제 공동 일정 사용으로 이어지는지 측정한다.
- OCR 기능이 일정 생성을 돕는지 측정한다.
- 개인정보를 수집하지 않고도 제품 의사결정에 필요한 집계 지표를 만든다.

### 비목표

- 광고 성과, 검색 유입과 캠페인 귀속 분석을 담당하지 않는다.
- 개별 사용자의 상세 행동을 감시하거나 재생하지 않는다.
- 관리자 감사, 보안 이벤트와 제재 기록을 대체하지 않는다.
- 오류 원인, 스택 트레이스와 장애 진단을 담당하지 않는다.
- 모든 버튼 클릭이나 UI 상호작용을 수집하지 않는다.
- 기존 데이터를 Mixpanel에 소급 적재하지 않는다.

## 4. 핵심 지표

### 북극성 지표: 주간 활성 일정 사용자

`Weekly Active Scheduling Users`는 분석 수집에 동의한 만 14세 이상 사용자 중 한
주에 다음 행동을 하나 이상 수행한 고유 사용자 수다.

- 일정 생성
- 일정 수정
- 일정 확인
- 일정 완료
- 예비 할 일을 일정으로 전환

단순 로그인이나 화면 조회는 북극성 지표에 포함하지 않는다.

### 활성화 퍼널

다음 순서를 7일 전환 창으로 측정한다.

1. `login_completed`
2. `room_created` 또는 `invite_redeemed`
3. `schedule_created`
4. `schedule_checked` 또는 `schedule_completed`

### 협업 퍼널

다음 순서를 14일 전환 창으로 측정한다.

1. `invite_created`
2. `invite_redeemed`
3. `schedule_created`

### OCR 전환

다음 순서를 같은 세션 내 퍼널로 측정한다.

1. `schedule_ocr_completed`
2. `schedule_created` with `creation_method = ocr_assisted`

## 5. 수집 구조

### 하이브리드 원칙

서버는 데이터베이스 반영이 확인된 중요한 성공 이벤트를 전송한다.

- 로그인 성공
- 방 생성
- 초대 발급과 사용
- 일정 생성, 수정, 확인과 완료
- 예비 할 일 생성과 완료

클라이언트는 서버가 알 수 없는 안전한 UI 행동만 전송한다.

- 허용된 화면 진입
- OCR 처리 완료
- 예비 할 일에서 일정 폼으로 전환한 뒤 일정 생성 완료

동일한 성공 이벤트를 서버와 클라이언트 양쪽에서 전송하지 않는다.
서버 이벤트가 존재하면 클라이언트는 같은 이벤트를 보내지 않는다.

### 분석 모듈 경계

구현 시 다음 경계를 사용한다.

```text
src/lib/analytics/
├── events.ts       이벤트명과 속성 타입, 허용 열거형
├── privacy.ts      금지 키 및 사용자 생성 콘텐츠 차단
├── identity.ts     불투명 분석 식별자 생성과 검증
├── client.ts       브라우저 SDK 초기화 및 전송 래퍼
├── server.ts       서버 SDK 초기화 및 전송 래퍼
└── context.ts      환경, 앱 버전과 공통 속성 생성
```

React 컴포넌트, Route Handler와 Server Action은 `mixpanel-browser` 또는
`mixpanel`을 직접 import하지 않는다. 다음 분석 인터페이스만 호출한다.

```text
trackClientEvent(event, properties)
trackServerEvent(actorContext, event, properties)
identifyAnalyticsUser(analyticsDistinctId)
resetAnalyticsUser()
optInAnalytics()
optOutAnalytics()
```

`events.ts`는 이벤트별 속성 타입을 판별 가능한 유니언으로 정의해야 한다.
임의 문자열 이벤트와 임의 객체 속성 전송을 허용하지 않는다.

## 6. 동의 모델

### 저장 상태

기존 `user_preferences`에 다음 분석 동의 상태를 추가하는 방향으로 설계한다.

```text
analytics_enabled boolean not null default false
analytics_consented_at timestamptz null
analytics_consent_version text null
analytics_revoked_at timestamptz null
```

이 변경은 Supabase 마이그레이션이 필요하다. 프로젝트 규칙에 따라 구현 전에
마이그레이션 생성에 대한 사용자 승인을 별도로 받아야 한다.

### 수집 허용 조건

서버와 클라이언트는 모두 다음 조건을 만족할 때만 이벤트를 전송한다.

```text
profile.account_state = active
profile.is_under_14 = false
user_preferences.analytics_enabled = true
user_preferences.analytics_consent_version = 현재 버전
```

조건을 확인할 수 없거나 조회에 실패하면 수집하지 않는다. 분석에서는
fail-closed를 적용하고, 본래 제품 기능에서는 fail-open을 적용한다.

### 동의 변경

- 최초 동의 시 상태를 저장한 뒤 `analytics_opted_in`을 한 번 전송한다.
- 동의 철회 시 먼저 상태를 비활성화하고 클라이언트 `opt_out`과 `reset`을
  실행한다.
- 동의 철회 자체는 Mixpanel 이벤트로 보내지 않는다.
- 만 14세 미만 계정에는 분석 동의 UI를 제공하지 않는다.
- 동의 문구가 실질적으로 변경되면 동의 버전을 올리고 다시 동의받는다.

## 7. 사용자 식별 수명주기

### 분석용 식별자

Supabase 사용자 UUID를 Mixpanel에 직접 보내지 않는다. 서버에서 다음과
같은 불투명 식별자를 만든다.

```text
analytics_distinct_id = base64url(HMAC-SHA256(user_id, ANALYTICS_ID_KEY))
```

- `ANALYTICS_ID_KEY`는 서버 전용 환경변수다.
- 클라이언트에는 계산 결과만 전달한다.
- 이메일, 이름과 전화번호를 Mixpanel People 속성으로 설정하지 않는다.
- 동일한 키를 유지하는 동안 같은 사용자는 같은 분석 식별자를 가진다.
- 키 회전은 사용자 연속성을 끊으므로 별도 데이터 이전 결정 없이 수행하지
  않는다.

### 로그인

- 동의된 만 14세 이상 사용자의 로그인 성공은 서버에서 `login_completed`로
  기록한다.
- 로그인 이후 렌더링되는 앱 셸은 서버가 계산한 분석 식별자와 수집 가능
  여부만 클라이언트 Provider에 전달한다.
- Provider는 허용된 경우에만 `identify`를 호출한다.

### 로그아웃

- 로그아웃 요청 직후 클라이언트에서 `reset`을 호출한다.
- 다음 사용자가 이전 사용자의 Mixpanel 식별자를 상속하지 않게 한다.
- 로그아웃 이벤트 자체는 1차 이벤트 범위에서 제외한다.

### 회원탈퇴

- 탈퇴 요청이 수락되면 분석 동의를 즉시 비활성화한다.
- 브라우저에서 `opt_out`과 `reset`을 실행한다.
- 불투명 분석 식별자를 기준으로 Mixpanel 사용자 데이터 삭제 요청을
  개인정보 삭제 유지보수 흐름에 연결한다.
- Mixpanel 삭제가 일시적으로 실패해도 앱 탈퇴 처리를 롤백하지 않는다.
- 외부 삭제 재시도 상태와 결과는 Mixpanel이 아닌 내부 감사 또는 운영
  로그에 남긴다.

## 8. 환경변수 계약

```env
# 브라우저에 노출 가능한 Mixpanel 프로젝트 토큰
NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN=

# 동일 프로젝트에 서버 이벤트를 보낼 때 사용하는 서버 전용 별칭
MIXPANEL_PROJECT_TOKEN=

# 불투명 사용자 식별자 생성용 서버 비밀키
ANALYTICS_ID_KEY=

# 동의 문구 및 저장 상태의 버전
NEXT_PUBLIC_ANALYTICS_CONSENT_VERSION=2026-07
```

Mixpanel Project Token은 비밀 API 키가 아니지만 서버 코드에서 공개 환경변수에
직접 의존하지 않도록 브라우저와 서버 이름을 구분한다.

Development와 Production은 서로 다른 Mixpanel Project Token을 사용한다.
Preview 배포는 Development 프로젝트로 보내거나 분석 자체를 비활성화한다.

## 9. 이벤트 명명 규칙

- 이벤트명은 영문 `lower_snake_case`를 사용한다.
- 이름은 과거형 또는 완료 의미를 사용해 성공 시점을 분명히 한다.
- 객체와 행동이 드러나는 이름을 사용한다.
- `clicked`, `button_pressed` 같은 구현 중심 이벤트는 만들지 않는다.
- 기존 이벤트의 의미를 바꾸지 않는다. 의미가 바뀌면 새 이벤트를 만든다.
- 사용자 생성 문자열을 이벤트명이나 속성 키로 만들지 않는다.

## 10. 공통 속성

모든 이벤트는 분석 모듈이 허용한 공통 속성만 선택적으로 가진다.

| 속성 | 허용 값 | 설명 |
| --- | --- | --- |
| `environment` | `development`, `preview`, `production` | 실행 환경 |
| `app_version` | 배포 Git SHA의 짧은 값 | 배포 비교용 |
| `source_surface` | 정의된 화면 열거형 | 행동 시작 화면 |
| `actor_role` | `owner`, `manager`, `member`, `viewer`, `none` | 방 안에서의 권한 |
| `creation_method` | `manual`, `ocr_assisted`, `preliminary_conversion` | 일정 생성 방식 |
| `room_member_count_bucket` | `solo`, `2_to_5`, `6_to_10`, `11_plus` | 방 규모 구간 |
| `participant_count_bucket` | `one`, `2_to_5`, `6_plus` | 일정 참여자 구간 |

`app_version`은 제품의 배포 버전이며 사용자 또는 레코드 식별자가 아니다.

## 11. 금지 데이터

다음 값은 이벤트명, 이벤트 속성, People 속성과 Mixpanel 로그에 포함하지
않는다.

- 이메일과 관리자 ID
- 표시 이름과 방 닉네임
- 전화번호
- 생년월일과 정확한 나이
- 주소와 지도 검색어
- 일정 제목과 추가 정보
- 예비 할 일 제목과 메모
- 문의 제목, 내용과 답변
- 방 이름과 설명
- 초대 토큰과 전체 초대 URL
- Supabase 사용자 UUID
- 방, 일정, 구성원, 초대, 문의와 신고의 실제 ID
- OCR 이미지, OCR 원문과 추출된 문자열
- 오류 메시지와 스택 트레이스
- 요청 ID와 IP 주소

`privacy.ts`는 개발 환경에서 금지 키가 전달되면 예외를 발생시키고,
Production에서는 해당 이벤트를 폐기한 뒤 개인정보 없는 운영 경고만 남긴다.

## 12. 화면 열거형

`screen_viewed`는 실제 URL이나 pathname을 보내지 않고 다음 열거형만 사용한다.

```text
dashboard
rooms
room
today_tasks
preliminary_tasks
mypage
support
```

`/rooms/[roomId]`, `/join/[token]`, `/support/[inquiryId]`의 실제 경로는
전송하지 않는다. 초대 참여 화면은 토큰 노출 위험 때문에 1차 화면 조회
수집 대상에서 제외한다. 로그인, 회원가입과 프로필 완성 같은 공개 또는
가입 진행 화면도 1차 화면 조회 수집 대상에서 제외한다.

## 13. 1차 이벤트 카탈로그

### 계정 및 세션

| 이벤트 | 전송 위치 | 정확한 발생 조건 | 허용 속성 |
| --- | --- | --- | --- |
| `analytics_opted_in` | 분석 동의 저장 Route 또는 Action | 만 14세 이상 활성 계정의 동의 상태 저장 성공 직후, 최초 한 번 | `consent_version`, `source_surface` |
| `login_completed` | `src/app/api/auth/login/route.ts` | 인증, 계정 상태 판정, 인증 기록 및 감사 기록이 모두 성공한 뒤 | `destination` |
| `screen_viewed` | 클라이언트 Analytics Provider | 허용된 화면 열거형이 변경되고 수집 허용 상태일 때 | `screen` |

`destination`은 `dashboard`, `complete_profile`, `guardian_required` 같은 안전한
열거형으로 제한한다.

### 방과 초대

| 이벤트 | 전송 위치 | 정확한 발생 조건 | 허용 속성 |
| --- | --- | --- | --- |
| `room_created` | `src/app/actions/schedule-actions.ts`의 `createRoomAction` | `create_scheduling_room` RPC 성공 및 `room_id` 확인 후 | `default_view`, `business_hours_bucket` |
| `invite_created` | `src/app/api/rooms/[roomId]/invites/route.ts` | 초대 발급 성공 응답을 만들기 직전 | `grant_role`, `expiry_bucket`, `max_uses_bucket`, `actor_role` |
| `invite_redeemed` | `src/app/api/invites/[token]/invite-handlers.ts` | 초대 저장소 결과가 성공으로 매핑된 경우 | `granted_role` |

초대 토큰, 초대 ID, 방 ID와 초대 URL은 보내지 않는다.

### 일정

| 이벤트 | 전송 위치 | 정확한 발생 조건 | 허용 속성 |
| --- | --- | --- | --- |
| `schedule_created` | `saveScheduleAction` | 신규 일정과 참여자 저장이 모두 성공한 뒤 | `creation_method`, `actor_role`, `participant_count_bucket`, `duration_bucket`, `has_address`, `has_customer_phone`, `has_estimated_price` |
| `schedule_updated` | `saveScheduleAction` | 기존 일정과 참여자 갱신이 모두 성공한 뒤 | `actor_role`, `participant_count_bucket`, `changed_field_count_bucket` |
| `schedule_checked` | `updateScheduleCheckedAction` | `is_checked = true` 저장 성공 후 | `source_surface` |
| `schedule_completed` | `updateScheduleStatusAction` | 상태가 `completed`로 변경되고 저장에 성공한 뒤 | `source_surface`, `actor_role` |

`schedule_checked`는 `true` 전환만 기록하며 확인 해제는 기록하지 않는다.
`schedule_completed`도 완료 상태 진입만 기록하고 다른 상태 전환은 1차 범위에서
제외한다.

서버에서 `creation_method`를 정확히 알 수 있도록 구현 시 일정 저장 입력에
안전한 열거형을 추가해야 한다. 해당 값은 DB에 저장할 필요 없이 분석 문맥으로
사용할 수 있다.

### 예비 할 일

| 이벤트 | 전송 위치 | 정확한 발생 조건 | 허용 속성 |
| --- | --- | --- | --- |
| `preliminary_task_created` | `createPreliminaryTaskAction` | DB 생성 성공 후 | `priority`, `has_due_date`, `linked_to_room` |
| `preliminary_task_completed` | `updatePreliminaryTaskCompletedAction` | `is_completed = true` 저장 성공 후 | `priority`, `has_due_date`, `linked_to_room` |
| `preliminary_task_converted` | `ScheduleWorkspace` | 선택된 예비 할 일을 사용해 신규 일정 저장이 성공한 뒤 | `actor_role`, `participant_count_bucket` |

완료 해제와 단순 수정, 삭제는 1차 범위에서 제외한다.

### OCR

| 이벤트 | 전송 위치 | 정확한 발생 조건 | 허용 속성 |
| --- | --- | --- | --- |
| `schedule_ocr_completed` | `ScheduleWorkspace`의 OCR 성공 처리 | 이미지 인식과 일정 텍스트 파싱이 완료된 뒤 | `processing_time_bucket`, `extracted_field_count_bucket`, `file_size_bucket` |

OCR 실패는 Mixpanel에 보내지 않고 Sentry 또는 개인정보 없는 로컬 운영 로그로
진단한다. OCR 이미지, OCR 원문, 파싱 결과 문자열은 보내지 않는다.

## 14. 속성 구간 정의

정확한 값 대신 다음 구간만 사용한다.

```text
business_hours_bucket:
  up_to_8
  9_to_12
  13_plus

expiry_bucket:
  up_to_24h
  2_to_7d
  over_7d

max_uses_bucket:
  one
  2_to_5
  6_plus

duration_bucket:
  up_to_30m
  31_to_60m
  61_to_120m
  over_120m

changed_field_count_bucket:
  one
  2_to_3
  4_plus

processing_time_bucket:
  under_3s
  3_to_10s
  over_10s

extracted_field_count_bucket:
  none
  1_to_2
  3_to_5
  6_plus

file_size_bucket:
  under_1mb
  1_to_5mb
  over_5mb
```

## 15. 2차 후보 이벤트

1차 데이터가 안정적으로 수집된 뒤 필요성이 확인된 경우에만 추가한다.

- `google_calendar_opened`
- `navigation_opened`
- `room_deleted`
- `member_role_changed`
- `member_removed`
- `ownership_transferred`
- `preferences_updated`

전화와 문자 링크 클릭은 고객 연락처 사용에 관한 민감한 행동이므로 초기
수집 대상에서 제외한다.

## 16. 리포트와 보드 구성

무료 플랜의 저장 리포트 수를 고려해 다음 다섯 개를 우선 저장한다.

### 1. 활성화 퍼널

`login_completed` → `room_created OR invite_redeemed` → `schedule_created` →
`schedule_checked OR schedule_completed`, 7일 창.

### 2. 협업 퍼널

`invite_created` → `invite_redeemed` → `schedule_created`, 14일 창.

### 3. 일정 가치 퍼널

`schedule_created` → `schedule_checked OR schedule_completed`, 7일 창.
`creation_method`와 `room_member_count_bucket`으로 구분한다.

### 4. 주간 리텐션

첫 `schedule_created`를 시작 이벤트로 하고 북극성 행동 재발생을 주간 단위로
측정한다.

### 5. OCR 효과

`schedule_ocr_completed` → `schedule_created` 퍼널과
`creation_method = ocr_assisted` 비율을 함께 본다.

## 17. 실패 처리와 중복 방지

- 분석 모듈 초기화 실패는 UI에 표시하지 않는다.
- Mixpanel 전송 실패는 방, 초대, 일정과 예비 할 일 작업 결과를 변경하지
  않는다.
- 서버는 데이터베이스 성공이 확인된 뒤에만 이벤트를 전송한다.
- 분석 전송을 재시도하더라도 사용자 작업을 다시 실행하지 않는다.
- 중요한 서버 이벤트에는 Mixpanel의 중복 제거용 `$insert_id`를 사용할 수
  있다. 이 값은 분석용 속성으로 노출하지 않는다.
- `$insert_id`는 요청 ID나 실제 레코드 ID를 그대로 사용하지 않는다. 전송
  재시도에서도 같은 값을 유지하는 분석 전용 난수 또는 요청 문맥의 HMAC을
  사용한다.
- 분석 전송 실패를 Sentry에 보고할 경우 Project Token, 분석 식별자와 이벤트
  속성을 오류 메시지에 포함하지 않는다.

## 18. 테스트 전략

### 단위 테스트

- 모든 이벤트명이 카탈로그에 선언되어 있는지 검사한다.
- 이벤트별 허용 속성만 통과하는지 검사한다.
- 금지 키와 사용자 생성 콘텐츠 키가 차단되는지 검사한다.
- 각 숫자 구간 경계값을 검사한다.
- HMAC 분석 식별자가 결정적이고 원본 UUID를 노출하지 않는지 검사한다.
- 수집 허용 판정에서 기본값, 만 14세 미만, 비활성 계정과 동의 버전 불일치를
  차단하는지 검사한다.

### 통합 테스트

- 동의하지 않은 사용자의 서버 성공 이벤트가 전송되지 않는지 검사한다.
- 만 14세 미만 사용자의 이벤트가 전송되지 않는지 검사한다.
- 신규 일정과 수정 일정이 각각 올바른 이벤트 하나를 생성하는지 검사한다.
- 실패한 DB 작업이 성공 이벤트를 만들지 않는지 검사한다.
- 로그아웃 후 브라우저 식별자가 초기화되는지 검사한다.
- 탈퇴 요청 후 추가 이벤트가 발생하지 않는지 검사한다.

### 수동 검증

- Mixpanel Development 프로젝트의 Live View에서 이벤트명과 속성을 확인한다.
- 브라우저 Network에서 동의 전 Mixpanel 요청이 없는지 확인한다.
- 실제 URL, ID, 이메일, 전화번호, 주소와 OCR 문자열이 payload에 없는지
  확인한다.
- 동일 작업을 한 번 수행했을 때 이벤트가 한 번만 나타나는지 확인한다.
- Production Token으로 전환하기 전 Development 이벤트를 모두 점검한다.

## 19. 단계적 출시

### 단계 1: 기반과 동의

- Development Mixpanel 프로젝트를 사용한다.
- 동의 저장, 수집 허용 판정, 분석 식별자와 공통 분석 모듈을 구현한다.
- `analytics_opted_in`, `login_completed`, `screen_viewed`만 검증한다.

### 단계 2: 핵심 가치 이벤트

- 방, 초대, 일정과 예비 할 일의 서버 성공 이벤트를 추가한다.
- 이벤트 중복과 개인정보 유출 테스트를 통과시킨다.

### 단계 3: OCR 및 리포트

- OCR 이벤트와 생성 방식 문맥을 연결한다.
- 다섯 개의 저장 리포트를 만든다.
- Development 데이터를 검토한 뒤 Production Token을 활성화한다.

### 단계 4: 운영 검토

- 출시 후 2주 동안 이벤트 볼륨과 속성 품질을 점검한다.
- 사용하지 않는 속성을 제거한다.
- 2차 후보 이벤트는 실제 제품 질문이 생긴 경우에만 추가한다.

## 20. 구현 시 주요 코드 접점

- `src/app/layout.tsx`: 전역 Analytics Provider 배치
- `src/lib/auth.ts`: 서버가 분석 가능 여부와 불투명 식별자를 구성하는 경계
- `src/components/app/LoginForm.tsx`: 로그인 후 클라이언트 식별 전환 보조
- `src/components/app/BottomNavigation.tsx`: 로그아웃 시 `reset`
- `src/components/app/ScheduleWorkspace.tsx`: 안전한 UI 이벤트와 생성 방식 전달
- `src/components/app/RoomInvitePanel.tsx`: 서버가 처리하지 못하는 UI 문맥만 전달
- `src/app/actions/schedule-actions.ts`: 핵심 DB 성공 이벤트
- `src/app/api/auth/login/route.ts`: 로그인 성공 이벤트
- `src/app/api/rooms/[roomId]/invites/route.ts`: 초대 생성 이벤트
- `src/app/api/invites/[token]/invite-handlers.ts`: 초대 참여 이벤트
- `src/app/api/privacy/withdraw/route.ts`: 즉시 수집 중단 및 외부 삭제 연결
- `scripts/run-privacy-maintenance.mjs`: Mixpanel 삭제 재시도와 완료 처리 후보
- `src/data/database.types.ts`: 승인된 마이그레이션 적용 뒤 타입 재생성
- `.env.example`: 공개 식별자와 서버 비밀키 계약 추가

## 21. 완료 조건

- 분석 동의 전에는 브라우저와 서버 모두 Mixpanel 이벤트를 보내지 않는다.
- 만 14세 미만 사용자는 어떤 Mixpanel 이벤트도 보내지 않는다.
- 모든 이벤트가 타입이 있는 중앙 카탈로그를 통과한다.
- 1차 이벤트가 명시된 성공 조건에서 한 번만 전송된다.
- 금지 데이터가 Mixpanel payload에 포함되지 않는다.
- Development와 Production 데이터가 섞이지 않는다.
- 로그아웃, 동의 철회와 탈퇴 이후 사용자 식별이 남지 않는다.
- 분석 장애가 제품 기능의 성공과 실패에 영향을 주지 않는다.
- 다섯 개 리포트가 정의된 지표를 계산할 수 있다.

## 22. 공식 참고 자료

- [Mixpanel 설치](https://docs.mixpanel.com/docs/quickstart/install-mixpanel)
- [Mixpanel 사용자 식별](https://docs.mixpanel.com/docs/quickstart/identify-users)
- [Mixpanel 추적 대상 선정](https://docs.mixpanel.com/docs/what-to-track)
- [Mixpanel 옵트아웃 및 익명화](https://docs.mixpanel.com/docs/privacy/protecting-user-data)
