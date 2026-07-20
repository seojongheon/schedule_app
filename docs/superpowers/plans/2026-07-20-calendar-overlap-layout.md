# Calendar Overlap Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render daily schedule boxes without overlap, ordered left-to-right by actual creation time, and collapse only time bands with five or more simultaneous schedules into three boxes plus an accessible more list.

**Architecture:** Add `createdAt` to the existing schedule read model, then compute the timetable as pure boundary-based layout segments. React renders those segments inside a fixed-height 24-hour canvas and uses an existing Sheet for overflow groups, keeping filtering and schedule-detail navigation in the current component.

**Tech Stack:** Next.js 15, React 19, TypeScript, date-fns, Node test runner, Tailwind CSS

## Global Constraints

- Use `schedules.created_at`; do not create a database migration.
- Treat intervals as `[start, end)`, so an end equal to another start is not an overlap.
- Within each time band, older schedules are left of newer schedules by `createdAt`, then ID.
- Show every schedule when simultaneous concurrency is four or less.
- At concurrency five or more, show the oldest three schedules and a fourth `+N 더보기` column.
- The overflow Sheet lists every schedule in that crowded time band, not only hidden schedules.
- Highlight the more control when at least one hidden schedule matches the active filter/search.
- Do not change week-summary or month-calendar rendering.

---

## File Structure

- Create `src/lib/schedule-overlap-layout.ts`: pure time-band splitting, ordering, overflow, and adjacent-segment merging.
- Create `src/lib/schedule-overlap-layout.test.mjs`: behavior tests for ordering, concurrency transitions, exact boundaries, and five-plus overflow.
- Modify `src/domain/entities.ts`: add `Schedule.createdAt`.
- Modify `src/data/schedule-supabase.ts`: select and map `schedules.created_at`.
- Modify `src/lib/mock-data.ts`: supply deterministic creation timestamps.
- Modify `src/components/app/ScheduleWorkspace.tsx`: preserve creation time in optimistic schedule state.
- Modify `src/components/app/ScheduleCalendar.tsx`: render layout segments, fixed timetable canvas, highlighted more control, and full overflow list.
- Modify `src/data/schedule-ownership-contract.test.mjs`: assert the schedule loader and optimistic model include creation time.
- Create `src/components/app/schedule-calendar-overflow-contract.test.mjs`: assert the component uses the pure layout, full-list Sheet, hidden-match highlighting, and fixed canvas.
- Modify `PROJECT_PLAYBOOK.md`: record the final overlap behavior and verification result.

### Task 1: Expose schedule creation time

**Files:**
- Modify: `src/domain/entities.ts`
- Modify: `src/data/schedule-supabase.ts`
- Modify: `src/lib/mock-data.ts`
- Modify: `src/components/app/ScheduleWorkspace.tsx`
- Modify: `src/data/schedule-ownership-contract.test.mjs`

**Interfaces:**
- Produces: `Schedule.createdAt: string` for the layout task.
- Consumes: existing `public.schedules.created_at` database column.

- [ ] **Step 1: Add failing creation-time contract assertions**

Extend `src/data/schedule-ownership-contract.test.mjs`:

```js
assert.match(loader, /created_at/);
assert.match(loader, /createdAt:\s*schedule\.created_at/);
assert.match(entities, /createdAt:\s*string/);
assert.match(workspace, /createdAt:\s*selectedSchedule\?\.createdAt\s*\?\?\s*new Date\(\)\.toISOString\(\)/);
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node --test src/data/schedule-ownership-contract.test.mjs`

Expected: FAIL because the schedule entity and loader do not expose `createdAt`.

- [ ] **Step 3: Implement the read-model field**

Add to `Schedule`:

```ts
createdAt: string;
```

Add `created_at` to `SCHEDULE_COLUMNS`, map it with:

```ts
createdAt: schedule.created_at,
```

Give every mock schedule a stable ISO timestamp. In optimistic state use:

```ts
createdAt: selectedSchedule?.createdAt ?? new Date().toISOString(),
```

- [ ] **Step 4: Verify the focused contract and typecheck**

Run: `node --test src/data/schedule-ownership-contract.test.mjs && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the read model**

```bash
git add src/domain/entities.ts src/data/schedule-supabase.ts src/lib/mock-data.ts src/components/app/ScheduleWorkspace.tsx src/data/schedule-ownership-contract.test.mjs
git commit -m "feat: expose schedule creation time"
```

### Task 2: Build the boundary-based overlap layout

**Files:**
- Create: `src/lib/schedule-overlap-layout.ts`
- Create: `src/lib/schedule-overlap-layout.test.mjs`

**Interfaces:**
- Consumes:

```ts
export type ScheduleLayoutInput = {
  id: string;
  startMinute: number;
  endMinute: number;
  createdAt: string;
};
```

- Produces:

```ts
export type ScheduleLayoutSegment = {
  kind: 'schedule';
  scheduleId: string;
  startMinute: number;
  endMinute: number;
  columnIndex: number;
  columnCount: number;
};

export type ScheduleOverflowSegment = {
  kind: 'overflow';
  id: string;
  startMinute: number;
  endMinute: number;
  columnIndex: 3;
  columnCount: 4;
  scheduleIds: string[];
  hiddenScheduleIds: string[];
};

export function buildScheduleOverlapLayout(inputs: ScheduleLayoutInput[]): {
  scheduleSegments: ScheduleLayoutSegment[];
  overflowSegments: ScheduleOverflowSegment[];
};
```

- [ ] **Step 1: Write failing tests for ordinary overlap and creation order**

Create tests which pass two and three fully overlapping inputs in reverse array order and assert columns follow `createdAt`. Also assert non-overlapping and end-equals-start schedules each receive `columnIndex: 0`, `columnCount: 1`.

```js
const result = buildScheduleOverlapLayout([
  input('new', 540, 660, '2026-07-20T10:00:00Z'),
  input('old', 540, 660, '2026-07-20T09:00:00Z'),
]);
assert.deepEqual(result.scheduleSegments.map(({ scheduleId, columnIndex, columnCount }) => ({ scheduleId, columnIndex, columnCount })), [
  { scheduleId: 'old', columnIndex: 0, columnCount: 2 },
  { scheduleId: 'new', columnIndex: 1, columnCount: 2 },
]);
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --no-warnings --experimental-strip-types --test src/lib/schedule-overlap-layout.test.mjs`

Expected: FAIL because `schedule-overlap-layout.ts` does not exist.

- [ ] **Step 3: Implement boundary splitting and ordinary segments**

Normalize valid inputs, collect every unique start/end boundary, and for every adjacent band select active inputs with:

```ts
input.startMinute < bandEnd && input.endMinute > bandStart
```

Sort active inputs with:

```ts
const creationOrder = (left: ScheduleLayoutInput, right: ScheduleLayoutInput) =>
  left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
```

For one through four active schedules, emit one segment per active schedule with its sorted index and active count. Merge only adjacent schedule segments whose schedule ID, column index, and column count match.

- [ ] **Step 4: Run ordinary overlap tests and verify GREEN**

Run: `node --no-warnings --experimental-strip-types --test src/lib/schedule-overlap-layout.test.mjs`

Expected: ordinary overlap and exact-boundary tests PASS.

- [ ] **Step 5: Add failing tests for simultaneous overflow and non-overflow chains**

Add a five-way overlap test asserting:

```js
assert.deepEqual(result.scheduleSegments.map((segment) => segment.scheduleId), ['one', 'two', 'three']);
assert.deepEqual(result.overflowSegments[0].scheduleIds, ['one', 'two', 'three', 'four', 'five']);
assert.deepEqual(result.overflowSegments[0].hiddenScheduleIds, ['four', 'five']);
assert.equal(result.overflowSegments[0].columnCount, 4);
```

Add a chain of five schedules whose maximum concurrency is two and assert `overflowSegments.length === 0` and all five schedule IDs appear.

- [ ] **Step 6: Run overflow tests and verify RED**

Run: `node --no-warnings --experimental-strip-types --test src/lib/schedule-overlap-layout.test.mjs`

Expected: FAIL because five-way time bands are not collapsed.

- [ ] **Step 7: Implement overflow segments and stable merging**

When `active.length >= 5`, emit only `active.slice(0, 3)` with four columns and an overflow segment containing all IDs and `active.slice(3)` hidden IDs. Merge adjacent overflow segments only when the complete ordered `scheduleIds` and `hiddenScheduleIds` arrays are equal. Use band start/end in the overflow ID so different crowded cohorts never share UI state.

- [ ] **Step 8: Run all layout tests and verify GREEN**

Run: `node --no-warnings --experimental-strip-types --test src/lib/schedule-overlap-layout.test.mjs`

Expected: PASS with no failures.

- [ ] **Step 9: Commit the pure layout**

```bash
git add src/lib/schedule-overlap-layout.ts src/lib/schedule-overlap-layout.test.mjs
git commit -m "feat: calculate non-overlapping schedule lanes"
```

### Task 3: Render responsive segments and overflow details

**Files:**
- Modify: `src/components/app/ScheduleCalendar.tsx`
- Create: `src/components/app/schedule-calendar-overflow-contract.test.mjs`

**Interfaces:**
- Consumes: `buildScheduleOverlapLayout` and the segment types from Task 2.
- Produces: non-overlapping timetable buttons and an overflow Sheet that calls the existing `onScheduleClick(schedule)`.

- [ ] **Step 1: Write a failing component contract**

Create `src/components/app/schedule-calendar-overflow-contract.test.mjs` that reads `ScheduleCalendar.tsx` and asserts:

```js
assert.match(source, /buildScheduleOverlapLayout/);
assert.match(source, /hiddenSchedules\.some/);
assert.match(source, /scheduleIds\.map/);
assert.match(source, /참여자/);
assert.match(source, /onScheduleClick\(schedule\)/);
assert.match(source, /h-\[1344px\]/);
assert.doesNotMatch(source, /index % 2/);
assert.doesNotMatch(source, /min-w-\[142px\]/);
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node --test src/components/app/schedule-calendar-overflow-contract.test.mjs`

Expected: FAIL because the calendar still uses index parity and fixed minimum width.

- [ ] **Step 3: Integrate the layout calculator**

Build layout inputs from `selectedDaySchedules` with `minutesFromDayStart`, actual end minutes, and `createdAt`. Memoize both the layout result and an ID-to-schedule map.

Replace the direct `selectedDaySchedules.map` rendering with schedule segments. Render inside an absolute schedule area bounded by `left-16 right-3`; calculate:

```ts
left: `calc(${(segment.columnIndex / segment.columnCount) * 100}% + 2px)`,
width: `calc(${100 / segment.columnCount}% - 4px)`,
top: `${((segment.startMinute - dayStart) / totalMinutes) * 100}%`,
height: `${((segment.endMinute - segment.startMinute) / totalMinutes) * 100}%`,
```

Remove the parity-based `right`, fixed `left` on each button, fixed `min-w-[142px]`, and pixel minimum height. Use a one-line compact label when a segment is under 60 minutes and hide secondary text when the segment is too narrow.

- [ ] **Step 4: Separate the scroll viewport from the day canvas**

Make the outer ref element the scroll viewport:

```tsx
<div ref={timeTableRef} className={cn('overflow-y-auto bg-white', compact ? 'h-[420px]' : 'h-[1344px]')}>
  <div className="relative h-[1344px]">
    {/* hour rows, current time, schedule area */}
  </div>
</div>
```

This keeps the time scale identical in compact and full views.

- [ ] **Step 5: Render overflow controls with hidden-match highlighting**

For every overflow segment, resolve `hiddenScheduleIds` to schedules and compute:

```ts
const highlighted = hiddenSchedules.some((schedule) => isHighlighted(schedule));
```

Render `+${hiddenScheduleIds.length} 더보기` in column four. Clicking it stores the complete ordered `scheduleIds` array for the selected overflow segment.

- [ ] **Step 6: Add the full overflow Sheet**

Render an existing `Sheet` titled `겹친 일정 전체 보기`. Map the selected segment's complete `scheduleIds` and show each schedule title, formatted time range, and participant names computed with:

```ts
const participantNames = room.members
  .filter((member) => schedule.participantMemberIds.includes(member.id))
  .map((member) => member.nickname)
  .join(', ');
```

Each row is a button. On click, clear overflow state and call `onScheduleClick(schedule)`. Clear overflow state when the selected date changes or the referenced segment disappears.

- [ ] **Step 7: Run component contract, typecheck, and lint**

Run: `node --test src/components/app/schedule-calendar-overflow-contract.test.mjs && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 8: Commit the timetable UI**

```bash
git add src/components/app/ScheduleCalendar.tsx src/components/app/schedule-calendar-overflow-contract.test.mjs
git commit -m "feat: render crowded schedule time bands"
```

### Task 4: Verify, document, merge, and publish

**Files:**
- Modify: `PROJECT_PLAYBOOK.md`

**Interfaces:**
- Consumes: completed data, layout, and UI tasks.
- Produces: verified `main` branch and operational record.

- [ ] **Step 1: Add the playbook record**

Append a dated entry recording the old parity/min-width cause, creation-time band layout, simultaneous-five overflow rule, complete overflow list, filter highlighting, and fixed compact canvas. Do not include credentials or user data.

- [ ] **Step 2: Run the complete verification gate**

Run:

```bash
npm run test:unit && npm run test:security && npm run typecheck && npm run lint && npm run build
```

Expected: all tests pass, TypeScript and ESLint exit zero, and Next.js production build completes.

- [ ] **Step 3: Commit the operational record**

```bash
git add PROJECT_PLAYBOOK.md
git commit -m "docs: record calendar overlap rollout"
```

- [ ] **Step 4: Merge with an explicit merge commit**

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff codex/calendar-overlap-layout -m "merge: improve calendar overlap layout"
```

- [ ] **Step 5: Re-run the complete verification gate on main**

Run the same command from Step 2.

Expected: every command exits zero on the merged `main` tree.

- [ ] **Step 6: Push main and verify synchronization**

```bash
git push origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git status --short --branch
```

Expected: `main...origin/main` with no working-tree changes.
