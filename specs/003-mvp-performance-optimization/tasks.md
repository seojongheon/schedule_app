# Tasks: MVP scheduling performance optimization

**Input**: Design documents from `/specs/003-mvp-performance-optimization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Focused automated tests MUST be written and observed failing before each behavioral implementation. Full unit, security, typecheck, lint, build, and authenticated browser checks are required before handoff.

**Implementation prerequisite**: Use `superpowers:using-git-worktrees` to create a clean isolated worktree because the current primary checkout contains unrelated changes.

## Phase 1: Setup and baseline

**Purpose**: Establish reproducible measurements before behavior changes.

- [ ] T001 Replace the explicit planning limitations with ten-run baseline timings, page-data bytes, Supabase request counts, current denial outcomes, and a fresh `npm run build` result in `specs/003-mvp-performance-optimization/validation.md`

**Checkpoint**: Baseline evidence exists before any production-code change.

---

## Phase 2: Foundational boundaries

No shared infrastructure, dependency, database object, or client state library is introduced. Each user story owns its focused test and source boundary.

**Checkpoint**: Existing project structure and verification commands remain the foundation.

---

## Phase 3: User Story 1 - Complete routine updates without a full reload (Priority: P1) 🎯 MVP

**Goal**: Successful routine mutations settle from returned/local state without a complete workspace reread, and failed optimistic mutations roll back.

**Independent Test**: Run the refresh contract test and exercise checked-state and task-completion success/failure without a complete workspace request.

- [ ] T002 [US1] Create failing no-refresh and no-broad-revalidation source contract tests in `src/components/app/workspace-refresh-contract.test.mjs`
- [ ] T003 [US1] Remove routine and navigation-adjacent `router.refresh()` calls while preserving existing local updates and `router.push()` destinations in `src/components/app/ScheduleWorkspace.tsx`
- [ ] T004 [US1] Remove `revalidateApp()`, the `revalidatePath` import, and all dynamic workspace path invalidations in `src/app/actions/schedule-actions.ts`
- [ ] T005 [US1] Extend `src/components/app/workspace-refresh-contract.test.mjs` to assert checked-state and task-completion handlers retain their previous-state rollback paths
- [ ] T006 [US1] Run the focused refresh contract plus affected unit/security tests and record the P1 checkpoint in `specs/003-mvp-performance-optimization/validation.md`

**Checkpoint**: User Story 1 is independently usable and routine mutation success triggers no complete workspace request.

---

## Phase 4: User Story 2 - Open each screen with only relevant data (Priority: P2)

**Goal**: Each workspace route reads explicit columns and only the data categories permitted by its page scope.

**Independent Test**: Run the scope matrix tests and open all six routes with representative data while inspecting their Supabase requests.

- [ ] T007 [P] [US2] Add failing Korean calendar-day bound and midnight-overlap cases to `src/lib/schedule-day.test.mjs`
- [ ] T008 [US2] Implement deterministic Korean calendar-day query bounds in `src/lib/schedule-day.ts`
- [ ] T009 [P] [US2] Create failing page scope matrix and room-identifier validation tests in `src/data/schedule-workspace-query.test.mjs`
- [ ] T010 [US2] Implement `ScheduleWorkspacePage`, `ScheduleWorkspaceRequest`, and `buildWorkspaceQueryPlan()` in `src/data/schedule-workspace-query.ts`
- [ ] T011 [US2] Refactor `getScheduleWorkspaceData()` to consume the query plan, use explicit select columns, apply today/room filters, skip excluded tables, and preserve the existing result shape in `src/data/schedule-supabase.ts`
- [ ] T012 [US2] Pass explicit page scopes and the validated room identifier from `src/app/dashboard/page.tsx`, `src/app/dashboard/today/page.tsx`, `src/app/dashboard/preliminary/page.tsx`, `src/app/rooms/page.tsx`, `src/app/rooms/[roomId]/page.tsx`, and `src/app/mypage/page.tsx`
- [ ] T013 [US2] Add source/query contract coverage for wildcard exclusion, table-scope exclusion, and room/today filters in `src/data/schedule-supabase.test.mjs`
- [ ] T014 [US2] Run schedule-day, query-plan, loader, dashboard-schedule, typecheck, and route build checks and record the P2 checkpoint in `specs/003-mvp-performance-optimization/validation.md`

**Checkpoint**: All six routes preserve visible behavior and excluded data categories issue no query.

---

## Phase 5: User Story 3 - Navigate securely with less repeated identity work (Priority: P3)

**Goal**: Public routes bypass protected work and protected routes use cryptographically verified claims without changing access decisions.

**Independent Test**: Run verified-identity and middleware policy tests across public, valid, signed-out, restricted, and expired scenarios while confirming fresh Auth user-record requests are absent from the protected UI path.

- [ ] T015 [P] [US3] Create failing verified subject/email, missing-subject, and claim-error tests in `src/lib/auth/verified-identity.test.mjs`
- [ ] T016 [US3] Implement the typed `getVerifiedIdentity()` claim boundary in `src/lib/auth/verified-identity.ts`
- [ ] T017 [US3] Add the public fast path and replace middleware `getUser()` identity lookup with verified claims while preserving profile/session/activity policy in `src/middleware.ts`
- [ ] T018 [US3] Replace page `getUser()` identity lookup with verified claims and explicit profile columns while preserving profile/role redirects in `src/lib/auth.ts`
- [ ] T019 [US3] Extend `src/lib/auth/verified-identity.test.mjs` and `src/lib/auth/middleware-access.test.mjs` with source and decision contracts for public bypass, invalid claims, restricted accounts, expired sessions, and unchanged API denials

**Checkpoint**: User Story 3 preserves every documented security outcome with fewer fresh identity-service requests where asymmetric verification is available.

---

## Phase 6: Polish and cross-cutting verification

- [ ] T020 [P] Run `npm run test:unit`, `npm run test:security`, `npm run typecheck`, `npm run lint`, and `git diff --check`, recording exact results in `specs/003-mvp-performance-optimization/validation.md`
- [ ] T021 [P] Run `npm run build`, compare workspace and middleware sizes with the 207 kB and 91.7 kB baselines, and record results in `specs/003-mvp-performance-optimization/validation.md`
- [ ] T022 Repeat the seven authenticated browser flows ten times, calculate medians and threshold results, and record direct evidence plus limitations in `specs/003-mvp-performance-optimization/validation.md`
- [ ] T023 Re-run the Spec Kit consistency audit, mark completed tasks, review scope against `specs/003-mvp-performance-optimization/spec.md`, and commit only feature-owned files listed in `specs/003-mvp-performance-optimization/plan.md`

## Dependencies and execution order

- T001 precedes every production-code change.
- T002–T006 deliver the P1 MVP independently.
- T007–T014 and T015–T019 can begin in parallel after T001 because their source files and primary behavior are independent.
- T011 depends on T008 and T010.
- T012–T014 depend on T011.
- T017–T019 depend on T016.
- T020–T023 run after all selected user stories.

## Parallel opportunities

- T007 and T009 can run in parallel because they create tests in different modules.
- The P2 scoped-data slice and P3 verified-identity slice can run in parallel after baseline capture.
- T020 and T021 can run in parallel after implementation because they use independent verification commands, although final reporting waits for both.

## Parallel example

```text
Worker A: T007–T014 in src/lib/schedule-day.ts, src/data/, and workspace page entry files.
Worker B: T015–T019 in src/lib/auth/, src/lib/auth.ts, and src/middleware.ts.
```

Do not run T011 and T012 concurrently, and do not run T016–T018 concurrently, because each pair has a direct interface dependency.

## Implementation strategy

### MVP first

1. Capture T001 baseline.
2. Complete T002–T006.
3. Stop and validate routine mutation behavior independently.

### Incremental delivery

1. Deliver P1 refresh removal.
2. Deliver P2 scoped data reads and compare page response sizes.
3. Deliver P3 claim verification and compare identity-service requests.
4. Run full automated and browser verification.

### Deferred follow-ups

Calendar-range fetching, the large workspace component split, a database RPC, and new indexes require a separate measured specification and are not hidden tasks in this feature.
