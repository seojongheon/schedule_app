# Tasks: 주간 캘린더 일정 슬롯 오버플로 개선

**Input**: Design documents from `/specs/001-fix-week-calendar-overflow/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/weekly-calendar-preview.md`, `quickstart.md`

**Tests**: Constitution I requires red-green-refactor. Unit and browser failure evidence must precede the related implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no unfinished dependency
- **[Story]**: Maps implementation work to a user story in `spec.md`

## Phase 1: Setup

**Purpose**: Add a dependency-free unit-test entry point.

- [x] T001 Add the Node 22 `test:unit` command for `src/components/app/week-calendar-preview.test.mjs` in `package.json`

---

## Phase 2: Foundational — Preview Policy Test Boundary

**Purpose**: Establish the shared two-item preview policy before either user-story implementation consumes it.

**⚠️ CRITICAL**: T002 must fail for the expected missing-module reason before T003 creates production code.

- [x] T002 Create the failing 0/1/2/3/8/100 schedule and input-immutability tests in `src/components/app/week-calendar-preview.test.mjs`, then run `npm run test:unit` and confirm `ERR_MODULE_NOT_FOUND`
- [x] T003 Implement `buildWeekSchedulePreview<T>` and `WEEK_SCHEDULE_PREVIEW_LIMIT` in `src/components/app/week-calendar-preview.ts`, then run `npm run test:unit` and `npm run typecheck`

**Checkpoint**: The preview policy is framework-independent, tested, and ready for the weekly calendar.

---

## Phase 3: User Story 1 — 좁은 화면에서도 일정 제목을 안정적으로 확인 (Priority: P1) 🎯 MVP

**Goal**: Long schedule titles remain on one line inside their assigned day cell at all target mobile widths.

**Independent Test**: At 320px, 375px, and 430px, long Korean, Latin, and unbroken titles stay inside previous/current/next week day-cell bounds without changing slot height.

### Tests for User Story 1

- [ ] T004 [US1] Reproduce and record the pre-fix 320px overflow condition using the Browser Validation and Computed Layout Checks in `specs/001-fix-week-calendar-overflow/quickstart.md`

### Implementation for User Story 1

- [ ] T005 [US1] Add `min-w-0`, `max-w-full`, `overflow-hidden`, fixed one-line height, and truncation boundaries to weekly panels, day buttons, schedule lists, and schedule slots in `src/components/app/ScheduleCalendar.tsx`
- [ ] T006 [US1] Run `npm run typecheck`, `npm run lint`, and the 320px/375px/430px previous-current-next browser checks for empty, long Korean, long Latin, and unbroken titles from `specs/001-fix-week-calendar-overflow/quickstart.md`

**Checkpoint**: User Story 1 is visually contained and independently demonstrable without changing schedule counts.

---

## Phase 4: User Story 2 — 기존 일정 개수와 더보기 규칙 유지 (Priority: P2)

**Goal**: The weekly preview continues to show two schedules and one accurate `+N개` slot for all larger counts.

**Independent Test**: Counts 0, 1, 2, 3, 8, and 100 produce the exact visible and hidden counts from the UI contract while date selection and filtering remain unchanged.

### Tests for User Story 2

- [ ] T007 [US2] Re-run `src/components/app/week-calendar-preview.test.mjs` and confirm all count and immutability cases pass before integrating the tested helper

### Implementation for User Story 2

- [ ] T008 [US2] Consume `buildWeekSchedulePreview` for schedule mapping and the `+N개` slot, and give the more slot the same one-line containment in `src/components/app/ScheduleCalendar.tsx`
- [ ] T009 [US2] Verify 0/1/2/3/8/100 counts plus search, participant-filter, swipe, date-selection, monthly-calendar, and selected-day-timetable regressions using `specs/001-fix-week-calendar-overflow/quickstart.md`

**Checkpoint**: User Stories 1 and 2 both satisfy their independent acceptance scenarios.

---

## Phase 5: Polish & Cross-Cutting Verification

**Purpose**: Produce fresh completion evidence and close specification gaps.

- [ ] T010 Run `npm run test:unit`, `npm run typecheck`, `npm run lint`, and `npm run build`, then confirm every command exits 0 against `specs/001-fix-week-calendar-overflow/quickstart.md`
- [ ] T011 Verify FR-001 through FR-010 and SC-001 through SC-005 against the implementation and browser evidence, then mark completed entries in `specs/001-fix-week-calendar-overflow/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 starts immediately.
- Phase 2 depends on T001 and blocks both user stories.
- Phase 3 depends on Phase 2 and delivers the P1 MVP.
- Phase 4 depends on Phase 3 because both stories update `ScheduleCalendar.tsx` sequentially.
- Phase 5 depends on both user stories.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on the tested preview foundation; independently verifiable through layout measurements.
- **User Story 2 (P2)**: Depends on User Story 1's containment classes so the more slot can share the same boundary without overlapping edits.

### Parallel Opportunities

No implementation tasks are marked `[P]` because the TDD gates are sequential and both user stories modify the same component. Automated unit, typecheck, and lint commands may run concurrently only after the relevant production edit is complete.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases with observed RED and GREEN unit evidence.
2. Complete User Story 1 and validate all three mobile widths.
3. Stop and confirm the P1 overflow fix independently.
4. Integrate the tested count policy for User Story 2.
5. Run full cross-cutting verification and convergence.

### Incremental Delivery

1. Test boundary → no user-visible change.
2. P1 containment → long titles no longer break the weekly grid.
3. P2 policy integration → existing two-item and more behavior becomes regression-protected.
4. Full regression → specification and constitution gates are checked before handoff.

## Notes

- Never mark a task complete before its command or browser evidence is fresh.
- Do not add dependencies, migrations, or unrelated refactors.
- Keep all main-checkout user changes untouched; all work occurs on `codex/week-calendar-overflow`.
