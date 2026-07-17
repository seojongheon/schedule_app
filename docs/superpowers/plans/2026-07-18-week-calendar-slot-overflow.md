# Week Calendar Slot Overflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the weekly calendar at two visible schedules plus one more slot while preventing long titles from crossing day-cell boundaries or creating extra lines.

**Architecture:** Move the two-item preview calculation into a framework-independent generic helper and consume it from `ScheduleCalendar`. Keep rendering in the existing component, but apply shrink and overflow constraints at every grid/container/slot boundary. Use Node's built-in test runner for the preview policy and browser measurements for CSS behavior.

**Tech Stack:** TypeScript 5.7, Node.js 22.14 `node:test`, Next.js 15, React 19, Tailwind CSS 3.4

## Global Constraints

- Weekly preview remains exactly two schedule slots plus one `+N개` slot when schedules exceed two.
- No new package dependency is allowed.
- Monthly calendar, selected-day timetable, search, participant filters, swiping, and date selection must not change.
- Existing user changes in the main checkout must not be touched or committed.
- Browser validation must cover 320px, 375px, and 430px widths with long Korean, Latin, and unbroken titles.

---

## Requirements Coverage

- Task 1 covers FR-003, FR-004, FR-009, and SC-002.
- Task 2 covers FR-001, FR-002, FR-005, FR-006, FR-007, FR-008, SC-001, SC-003, SC-004, and SC-005.
- Task 3 covers FR-010 and re-verifies FR-001 through FR-010 and SC-001 through SC-005 before completion.

### Task 1: Protect the two-item preview policy with a failing unit test

**Files:**
- Create: `src/components/app/week-calendar-preview.test.mjs`
- Create: `src/components/app/week-calendar-preview.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: a `readonly T[]` in existing schedule order
- Produces: `buildWeekSchedulePreview<T>(schedules: readonly T[]): { visibleSchedules: T[]; hiddenCount: number }`

- [ ] **Step 1: Write the failing unit test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWeekSchedulePreview } from './week-calendar-preview.ts';

test('shows at most two schedules and reports the remaining count', () => {
  const cases = [
    { total: 0, visible: 0, hidden: 0 },
    { total: 1, visible: 1, hidden: 0 },
    { total: 2, visible: 2, hidden: 0 },
    { total: 3, visible: 2, hidden: 1 },
    { total: 8, visible: 2, hidden: 6 },
    { total: 100, visible: 2, hidden: 98 },
  ];

  for (const expectation of cases) {
    const schedules = Array.from({ length: expectation.total }, (_, index) => ({ id: index }));
    const preview = buildWeekSchedulePreview(schedules);

    assert.equal(preview.visibleSchedules.length, expectation.visible);
    assert.equal(preview.hiddenCount, expectation.hidden);
    assert.deepEqual(preview.visibleSchedules, schedules.slice(0, 2));
  }
});

test('does not mutate the source schedule array', () => {
  const schedules = Object.freeze([{ id: 1 }, { id: 2 }, { id: 3 }]);

  buildWeekSchedulePreview(schedules);

  assert.deepEqual(schedules, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});
```

- [ ] **Step 2: Add the unit-test command**

Add this entry under `scripts` in `package.json`:

```json
"test:unit": "node --no-warnings --experimental-strip-types --test src/components/app/week-calendar-preview.test.mjs"
```

- [ ] **Step 3: Run the test and verify RED**

Run: `npm run test:unit`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `week-calendar-preview.ts`.

- [ ] **Step 4: Implement the minimal preview helper**

```ts
export const WEEK_SCHEDULE_PREVIEW_LIMIT = 2;

export function buildWeekSchedulePreview<T>(schedules: readonly T[]) {
  return {
    visibleSchedules: schedules.slice(0, WEEK_SCHEDULE_PREVIEW_LIMIT),
    hiddenCount: Math.max(schedules.length - WEEK_SCHEDULE_PREVIEW_LIMIT, 0),
  };
}
```

- [ ] **Step 5: Run the unit test and verify GREEN**

Run: `npm run test:unit`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 6: Run focused static verification**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 7: Commit Task 1**

```bash
git add package.json src/components/app/week-calendar-preview.ts src/components/app/week-calendar-preview.test.mjs
git commit -m "test: protect weekly schedule preview limit"
```

### Task 2: Contain weekly day cells and slots at narrow widths

**Files:**
- Modify: `src/components/app/ScheduleCalendar.tsx`

**Interfaces:**
- Consumes: `buildWeekSchedulePreview(daySchedules)` from Task 1
- Produces: weekly day cells whose schedule and more slots stay within their assigned grid track and one text line

- [ ] **Step 1: Record the failing browser layout case before editing**

Run: `npm run dev`

At 320px viewport width, load a week containing a title longer than 40 unbroken characters. Inspect the current-week day cells and record at least one of these RED conditions:

```text
dayCell.scrollWidth > dayCell.clientWidth
slot.getBoundingClientRect().right > dayCell.getBoundingClientRect().right
getComputedStyle(slot).whiteSpace permits wrapping
slot height differs because the title creates another line
```

Expected: the reported title-overflow symptom is reproducible before the CSS boundary change.

- [ ] **Step 2: Import and consume the tested preview helper**

Add the import:

```ts
import { buildWeekSchedulePreview } from '@/components/app/week-calendar-preview';
```

After `daySchedules` is assigned inside `renderWeekDays`, add:

```ts
const { visibleSchedules, hiddenCount } = buildWeekSchedulePreview(daySchedules);
```

Replace:

```tsx
{daySchedules.slice(0, 2).map((schedule) => {
```

with:

```tsx
{visibleSchedules.map((schedule) => {
```

Replace the more-slot condition and count with:

```tsx
{hiddenCount > 0 ? (
  <span className="block h-5 w-full min-w-0 max-w-full truncate px-0 text-left text-[9px] font-bold leading-5 tracking-tight text-gray-400">
    +{hiddenCount}개
  </span>
) : null}
```

- [ ] **Step 3: Apply explicit containment to every relevant layout boundary**

Use these exact class strings for the affected elements:

```tsx
// Day button
'flex min-h-24 min-w-0 max-w-full overflow-hidden flex-col rounded-2xl px-0.5 py-2 text-center transition'

// Schedule list
<div className="mt-1 min-h-11 w-full min-w-0 max-w-full flex-1 space-y-1 overflow-hidden">

// Schedule slot base classes
'block h-5 w-full min-w-0 max-w-full truncate rounded px-0.5 text-left text-[10px] font-bold leading-5'

// Each previous/current/next week grid panel
<div className="grid w-1/3 min-w-0 shrink-0 grid-cols-7 gap-1 overflow-hidden">
```

- [ ] **Step 4: Run unit and static checks**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
```

Expected: all commands exit 0; unit output reports 2 pass, 0 fail.

- [ ] **Step 5: Re-run the browser case and verify GREEN**

At 320px, 375px, and 430px, verify long Korean, long Latin, and unbroken titles in previous/current/next panels. For every visible schedule and more slot:

```text
slot.getBoundingClientRect().left >= dayCell.getBoundingClientRect().left
slot.getBoundingClientRect().right <= dayCell.getBoundingClientRect().right
getComputedStyle(slot).whiteSpace === 'nowrap'
the two schedule slots and one more slot keep fixed one-line heights
```

Expected: all measurements pass and the rendered preview remains two schedules plus `+N개`.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/components/app/ScheduleCalendar.tsx
git commit -m "fix: contain weekly calendar schedule titles"
```

### Task 3: Run full regression and requirement verification

**Files:**
- Modify: `specs/001-fix-week-calendar-overflow/tasks.md` (mark completed tasks only)

**Interfaces:**
- Consumes: completed implementation and `specs/001-fix-week-calendar-overflow/quickstart.md`
- Produces: fresh evidence for every automated and browser acceptance gate

- [ ] **Step 1: Run all automated verification commands fresh**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0; unit output reports 2 pass and 0 fail.

- [ ] **Step 2: Run the full quickstart browser regression**

Follow every numbered step in `specs/001-fix-week-calendar-overflow/quickstart.md` and record the outcomes for:

```text
320px / 375px / 430px
long Korean / long Latin / unbroken titles
0 / 1 / 2 / 3 / 8 / 100 schedules
previous / current / next week panels
search / participant filter / swipe / date selection
monthly calendar / selected-day timetable regression
```

Expected: no overflow, wrapping, count mismatch, or interaction regression.

- [ ] **Step 3: Re-read the spec and confirm coverage**

Check FR-001 through FR-010 and SC-001 through SC-005 against the fresh command and browser evidence. Any unmet item remains incomplete and must be added to the Spec Kit convergence pass.

- [ ] **Step 4: Commit completed task tracking and final documentation changes**

```bash
git add specs/001-fix-week-calendar-overflow/tasks.md
git commit -m "docs: record weekly calendar verification"
```
