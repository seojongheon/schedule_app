# Research: 주간 캘린더 일정 슬롯 오버플로 개선

## 날짜 셀의 레이아웃 경계

**Decision**: 7열 그리드 아이템인 날짜 버튼, 일정 목록, 일정/더보기 슬롯에 `min-width: 0`, `max-width: 100%`, `overflow: hidden`을 필요한 계층마다 명시하고 슬롯 텍스트를 한 줄 말줄임으로 고정한다.

**Rationale**: 수정 전 320px 브라우저 측정에서 긴 제목 span은 이미 한 줄 말줄임으로 경계 안에 있었지만, 더보기 슬롯은 일정 슬롯보다 낮았고(15px 대 20px) `+1개`의 내부 폭도 부족했다. 상위 grid item부터 슬롯까지 축소 경계를 명시해 회귀를 방지하고, 날짜/슬롯의 가로 패딩을 줄여 텍스트 가용 폭을 늘리며, 더보기 슬롯의 높이와 작은 글자 폭을 별도로 고정한다.

**Alternatives considered**:

- 글자 크기를 더 작게 조정: 짧은 화면에서 가독성을 낮추고 긴 비분리 문자열의 근본 원인을 해결하지 못해 제외.
- 주간 그리드에 가로 스크롤 추가: 한눈에 7일을 보는 핵심 흐름을 변경하므로 제외.
- 일정 슬롯을 별도 React 컴포넌트로 분리: 현재 변경 범위에 비해 구조 복잡도가 커져 제외.

## 표시 개수 테스트 경계

**Decision**: `buildWeekSchedulePreview<T>(schedules: readonly T[])` 순수 함수가 `{ visibleSchedules: T[]; hiddenCount: number }`를 반환하게 하고 컴포넌트가 이 결과만 렌더링한다.

**Rationale**: 일정 2개 + 더보기 정책을 DOM과 분리하면 0, 1, 2, 3, 다수의 경계를 외부 UI 테스트 도구 없이 빠르고 반복 가능하게 검증할 수 있다.

**Alternatives considered**:

- 컴포넌트 소스 문자열의 `slice(0, 2)` 검사: 구현 세부에 결합되고 실제 동작을 검증하지 못해 제외.
- React Testing Library 도입: 이번 한정 변경에 새 의존성과 설정 비용이 과도해 제외.

## 테스트 런타임

**Decision**: Node 22의 타입 제거 기능과 내장 테스트 러너를 사용해 `.mjs` 테스트에서 순수 `.ts` 모듈을 가져오고 `node --no-warnings --experimental-strip-types --test ...`로 실행한다. 애플리케이션의 모듈 형식은 바꾸지 않고 테스트 런타임에서 예상된 실험 기능 경고만 숨긴다.

**Rationale**: 현재 npm 스크립트 런타임이 Node 22.14.0이며 새 패키지 없이 TypeScript 순수 모듈을 검증할 수 있다. 테스트 파일은 typecheck 대상에서 제외되는 `.mjs`로 두어 애플리케이션 TypeScript 설정을 변경하지 않는다.

**Alternatives considered**:

- Vitest/Jest 설치: 외부 의존성 추가 금지 원칙과 변경 크기에 맞지 않아 제외.
- 빌드 후 JavaScript 산출물 테스트: 별도 출력 설정과 정리 단계가 필요해 제외.

## 시각 검증

**Decision**: 개발 서버에서 320px, 375px, 430px 너비를 각각 확인하고 긴 한글·영문·비분리 문자열의 `scrollWidth <= clientWidth`, 한 줄 높이, 인접 칸 비침범을 점검한다.

**Rationale**: CSS 오버플로는 순수 함수 테스트로 증명할 수 없으므로 실제 브라우저 레이아웃의 계산 결과를 확인해야 한다.

**Alternatives considered**:

- 스크린샷 육안 확인만 사용: 미세한 수평 넘침을 놓칠 수 있어 계산된 크기 확인을 함께 사용한다.
- 새 E2E 프레임워크 도입: 이번 변경에는 과도하므로 기존 브라우저 제어 기능을 사용한다.
