# Dashboard Calendar Schedule Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a participant's future room schedules in the dashboard calendar while keeping the "today tasks" list limited to schedules that overlap today.

**Architecture:** Extract the cross-room participant filter into a small pure helper. Derive the dashboard calendar input from every schedule assigned to the current profile, then derive the existing today-only list from that set using the existing date-overlap helper.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node test runner.

## Global Constraints

- Do not change schedule persistence, room-calendar behavior, or the existing date-overlap semantics.
- Keep the dashboard calendar limited to schedules assigned to the signed-in user.

---

### Task 1: Separate dashboard calendar and today-task schedule scopes

**Files:**
- Create: `src/lib/dashboard-schedules.ts`
- Create: `src/components/app/dashboard-schedules.test.mjs`
- Modify: `src/components/app/ScheduleWorkspace.tsx`

**Interfaces:**
- Produces: `getSchedulesAssignedToProfile(schedules, rooms, profileId): Schedule[]`.
- Consumes: `isScheduleOverlappingDay(startAt, endAt)` to derive today tasks after participant filtering.

- [x] **Step 1: Write the failing test**

```js
test('keeps a future schedule assigned to the current profile for the dashboard calendar', () => {
  const assigned = getSchedulesAssignedToProfile(schedules, rooms, 'user-minsu');

  assert.deepEqual(assigned.map((schedule) => schedule.id), ['august-assigned']);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --no-warnings --experimental-strip-types --test src/components/app/dashboard-schedules.test.mjs`

Expected: FAIL because `src/lib/dashboard-schedules.ts` does not exist.

- [x] **Step 3: Write minimal implementation**

```ts
export function getSchedulesAssignedToProfile(schedules: Schedule[], rooms: SchedulingRoom[], profileId: string) {
  return schedules.filter((schedule) => {
    const room = rooms.find((candidate) => candidate.id === schedule.roomId);
    const member = room?.members.find((candidate) => candidate.userId === profileId);
    return Boolean(member && schedule.participantMemberIds.includes(member.id));
  });
}
```

Use this result for `ScheduleCalendar` in `DashboardView`; derive `todaySchedules` from it before passing the today-task list.

- [x] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit && npm run typecheck`

Expected: all tests pass and TypeScript exits with code 0.
