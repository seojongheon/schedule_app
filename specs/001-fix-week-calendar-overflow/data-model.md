# Data Model: 주간 캘린더 일정 슬롯 오버플로 개선

## 기존 데이터

일정 엔터티와 저장 구조는 변경하지 않는다. 이 기능이 사용하는 기존 필드는 다음과 같다.

### Schedule

- `id`: 일정 슬롯의 안정적인 식별자
- `title`: 주간 미리보기에 한 줄로 표시할 제목
- `startAt`: 날짜별 그룹 결정
- `participantMemberIds`: 슬롯 색상과 공동 일정 여부 결정

필드 유효성, 관계, 저장 상태 전이는 이번 기능에서 바뀌지 않는다.

## 파생 표시 모델

### WeekSchedulePreview<T>

- `visibleSchedules: T[]`: 입력 순서를 보존한 앞의 최대 2개 일정
- `hiddenCount: number`: `max(전체 일정 수 - 2, 0)`

### 불변 조건

- `visibleSchedules.length <= 2`
- 입력 일정이 2개 이하면 `hiddenCount === 0`
- 입력 일정이 3개 이상이면 `visibleSchedules.length === 2`
- `visibleSchedules.length + hiddenCount === 입력 일정 수`
- 입력 배열은 수정하지 않는다.

## 상태 전이

영속 상태 전이는 없다. 일정 배열이 바뀔 때마다 표시 모델을 다시 계산하며, 검색 및 참가자 필터는 슬롯의 강조도만 바꾸고 표시 개수 계산에는 영향을 주지 않는다.
