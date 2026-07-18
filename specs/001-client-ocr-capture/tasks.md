# Tasks: Browser-local schedule screenshot OCR

**Input**: Design documents from `/specs/001-client-ocr-capture/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Focused unit tests are required before behavior changes. Full type,
lint, build, and browser checks are required before handoff.

## Phase 1: Setup

- [X] T001 Add a `test:unit` script for focused Node tests in package.json
- [X] T002 Add the browser-local OCR dependency and lockfile entry in package.json and package-lock.json

## Phase 2: Foundational parsing

- [X] T003 Create failing message parsing tests in src/components/app/schedule-text-parser.test.mjs for date, time, address, phone, cost, additional information, and title exclusion
- [X] T004 Extract the schedule text parser to src/components/app/schedule-text-parser.ts without changing its eligible field behavior
- [X] T005 Update src/components/app/ScheduleWorkspace.tsx to import the extracted parser from src/components/app/schedule-text-parser.ts

**Checkpoint**: Existing manual message automatic input remains independently testable.

## Phase 3: User Story 1 - Capture a message screenshot (Priority: P1) 🎯 MVP

**Goal**: A selected screenshot yields reviewed browser-local text in the existing message input.

**Independent Test**: Select a valid image through the helper contract and receive success text without a server request.

- [X] T006 [P] [US1] Create failing image validation and resize-dimension tests in src/components/app/image-ocr.test.mjs
- [X] T007 [US1] Implement image validation and 2048px local resize helpers in src/components/app/image-ocr.ts
- [X] T008 [US1] Implement lazy Korean/English browser-worker OCR and typed success, empty, unavailable, and failed results in src/components/app/image-ocr.ts
- [X] T009 [US1] Replace browser-specific image capture in src/components/app/ScheduleWorkspace.tsx with the local OCR helper and reviewed-text handoff

**Checkpoint**: OCR text appears in the existing textarea and schedule title remains manual.

## Phase 4: User Story 2 - Automatically fill schedule details (Priority: P2)

**Goal**: Reviewed OCR text fills only eligible details and preserves unrelated values.

**Independent Test**: Apply a complete recognized message and confirm date, times, address, phone, cost, and additional information fill without title mutation.

- [X] T010 [US2] Extend src/components/app/schedule-text-parser.test.mjs with regression cases for Korean mobile-number normalization and missing-value preservation
- [X] T011 [US2] Connect successful OCR text in src/components/app/ScheduleWorkspace.tsx to existing automatic field input exactly once
- [X] T012 [US2] Verify title exclusion in src/components/app/schedule-text-parser.test.mjs and editable OCR text through the available browser OCR flow; Chrome direct run is recorded as unavailable

**Checkpoint**: OCR-assisted automatic input is independently usable and manually correctable.

## Phase 5: User Story 3 - Recover on supported browsers (Priority: P3)

**Goal**: Users receive clear state and manual recovery across the target browsers.

**Independent Test**: Force non-success helper results and confirm form values remain and manual text input is usable.

- [X] T013 [US3] Add invalid-file recovery tests in src/components/app/image-ocr.test.mjs and preserve explicit non-success result handling in src/components/app/image-ocr.ts
- [X] T014 [US3] Add processing disablement and actionable status messages in src/components/app/ScheduleWorkspace.tsx
- [X] T015 [US3] Document Chrome, Safari, and Samsung Internet direct-execution evidence in specs/001-client-ocr-capture/quickstart.md

**Checkpoint**: No target-browser failure prevents manual schedule entry.

## Phase 6: Polish & verification

- [X] T016 Run `npm run test:unit`, `npm run typecheck`, worktree-safe ESLint, and `npm run build`
- [X] T017 Exercise the image capture flow in the available browser and record Chrome direct-test unavailability in specs/001-client-ocr-capture/quickstart.md
- [X] T018 Record an explicit direct-test result or not-run limitation for Safari and Samsung Internet in specs/001-client-ocr-capture/quickstart.md
- [X] T019 Run `git diff --check`, mark completed tasks, and commit feature artifacts and implementation

## Dependencies & Execution Order

- T001–T002 precede all test and OCR helper work.
- T003–T005 preserve the existing parser before OCR integration.
- T006–T009 implement the P1 capture slice.
- T010–T012 add P2 automatic-detail assurance after P1.
- T013–T015 add P3 recovery behavior after P1.
- T016–T019 run after all user stories.

## Implementation Strategy

1. Preserve and test the existing parser.
2. Add and test local OCR utilities.
3. Integrate the worker into the schedule-add form.
4. Validate Chrome directly and make Safari/Samsung Internet test availability explicit.
