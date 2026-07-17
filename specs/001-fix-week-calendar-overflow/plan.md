# Implementation Plan: 주간 캘린더 일정 슬롯 오버플로 개선

**Branch**: `codex/week-calendar-overflow` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fix-week-calendar-overflow/spec.md`

## Summary

주간 캘린더 날짜 셀과 일정 미리보기 슬롯의 축소·오버플로 경계를 명시해 긴 제목이 7열 그리드를 침범하거나 줄바꿈으로 세로 배치를 밀지 않도록 한다. 기존 일정 2개와 초과 개수 더보기 규칙은 순수 표시 함수로 분리해 Node 내장 테스트로 보호하고, 외부 패키지 추가 없이 모바일 뷰포트에서 실제 레이아웃을 검증한다.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24.14.1

**Primary Dependencies**: Next.js 15, React 19, Tailwind CSS 3.4, date-fns 4

**Storage**: N/A — 표시 파생 로직과 CSS 경계만 변경하며 일정 저장 구조는 유지

**Testing**: Node.js 내장 `node:test`, TypeScript typecheck, ESLint, Next.js production build, 브라우저 레이아웃 확인

**Target Platform**: 모바일 우선 웹, 320px·375px·430px 뷰포트

**Project Type**: Next.js App Router 웹 애플리케이션

**Performance Goals**: 날짜별 미리보기 계산은 일정 수와 무관하게 앞 2개 선택과 초과 개수 계산만 수행하고 새로운 렌더 반복을 추가하지 않음

**Constraints**: 외부 의존성 추가 금지, 일정 2개 + 더보기 유지, 월간/시간표/검색/필터/스와이프/날짜 선택 동작 변경 금지

**Scale/Scope**: 주간 패널 3개 × 각 7일, 날짜별 일정 0~100개 검증

## Constitution Check

*GATE: Phase 0 이전 및 Phase 1 설계 후 재확인 완료.*

- **Test-first**: `week-calendar-preview.test.mjs`를 먼저 작성하고 모듈 부재 실패를 확인한 뒤 순수 함수를 구현한다. 레이아웃은 320px·375px·430px 브라우저 확인으로 보완한다. **PASS**
- **Scoped change**: `ScheduleCalendar.tsx`, 새 순수 함수와 테스트, `package.json`의 테스트 명령만 애플리케이션 변경 범위다. 월간과 시간표는 회귀 확인만 수행한다. **PASS**
- **Responsive containment**: 날짜 셀·일정 목록·일정 슬롯·더보기 슬롯에 축소 가능한 최소 폭, 최대 폭, 오버플로 숨김, 한 줄 말줄임을 적용한다. **PASS**
- **Architecture and types**: 표시 규칙은 프레임워크 비의존 순수 TypeScript 함수로 분리하고 `npm run typecheck`를 실행한다. 데이터 및 도메인 경계 변경은 없다. **PASS**
- **Completion evidence**: `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`와 `quickstart.md`의 모바일 브라우저 시나리오를 새로 실행한다. **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-week-calendar-overflow/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── weekly-calendar-preview.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/components/app/
├── ScheduleCalendar.tsx
├── week-calendar-preview.ts
└── week-calendar-preview.test.mjs

package.json
docs/superpowers/plans/2026-07-18-week-calendar-slot-overflow.md
```

**Structure Decision**: 기존 프레젠테이션 컴포넌트와 함께 작은 순수 표시 함수를 둔다. 함수는 React나 경로 별칭을 사용하지 않아 Node 내장 테스트에서 직접 가져올 수 있으며, 레이아웃 클래스는 기존 `ScheduleCalendar` 안에 유지해 불필요한 컴포넌트 분리를 피한다.

## Post-Design Constitution Check

- 새 의존성이나 데이터 변경이 없고 테스트가 구현보다 먼저 배치된다.
- UI 계약에 한 줄 생략과 7열 경계를 명시했으며 빠른 시작 가이드에 세 뷰포트와 긴 문자열 사례를 포함했다.
- 애플리케이션 변경 파일과 회귀 확인 범위가 명확하므로 모든 constitution gate가 **PASS**다.
