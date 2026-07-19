# MVP Scheduling Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce authenticated workspace latency by eliminating redundant full-route refreshes, loading only page-relevant Supabase data, and replacing repeated fresh Auth user lookups with cryptographically verified claims.

**Architecture:** Keep the existing `ScheduleWorkspaceInitialData` compatibility boundary and RLS policies. Add one pure page-to-query-plan module, let the existing repository execute that plan with explicit columns, and isolate verified claims behind one pure adapter used by middleware and page profile loading. Do not add a cache, database object, dependency, or broad client-component refactor.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript 5.7, Supabase SSR 0.5.2, Supabase JS 2.110.0, PostgreSQL RLS, Node built-in test runner

## Global Constraints

- Use a clean isolated worktree for implementation because the primary checkout contains unrelated changes.
- Write and run a focused failing test before every behavioral production-code change.
- Preserve dashboard client-side calendar navigation and its complete schedule set.
- Preserve account-state, session-age, activity-touch, service-role, RLS, redirect, and API denial behavior.
- Preserve optimistic rollback and user-entered values on failure.
- Add no paid infrastructure, cache service, read replica, runtime dependency, database migration, new index, or client state library.
- Do not cache personalized workspace responses publicly or across users.
- Do not decompose the full `ScheduleWorkspace.tsx` component in this feature.
- Before handoff, run full unit, security, typecheck, lint, build, diff, and authenticated browser verification.

---

## File map

**Create during implementation:**

- `src/components/app/workspace-refresh-contract.test.mjs` — source contract for refresh removal and optimistic rollback.
- `src/data/schedule-workspace-query.ts` — pure page-scope query plan.
- `src/data/schedule-workspace-query.test.mjs` — scope matrix and validation tests.
- `src/data/schedule-supabase.test.mjs` — loader source/query boundary contract.
- `src/lib/auth/verified-identity.ts` — cryptographically verified claim adapter.
- `src/lib/auth/verified-identity.test.mjs` — claim and source-boundary tests.
- `specs/003-mvp-performance-optimization/validation.md` — baseline, command output, browser evidence, and threshold calculations.

**Modify during implementation:**

- `src/components/app/ScheduleWorkspace.tsx` — remove redundant route refreshes.
- `src/app/actions/schedule-actions.ts` — remove broad dynamic-route revalidation.
- `src/lib/schedule-day.ts` and `src/lib/schedule-day.test.mjs` — produce deterministic Korean-day query bounds.
- `src/data/schedule-supabase.ts` — execute page-scoped explicit-column reads.
- Six workspace page entry files — pass page scope and room identifier.
- `src/middleware.ts` — public fast path and claim identity.
- `src/lib/auth.ts` — claim identity and explicit profile fields.
- `specs/003-mvp-performance-optimization/tasks.md` — check off completed implementation tasks only after their evidence exists.

### Task 1: Capture the immutable baseline

**Files:**

- Modify: `specs/003-mvp-performance-optimization/validation.md`
- Reference: `specs/003-mvp-performance-optimization/quickstart.md`

**Interfaces:**

- Consumes: the seven flows and measurement fields in `quickstart.md`.
- Produces: baseline medians used by the final acceptance table.

- [ ] **Step 1: Create the validation record before changing production code**

Use the existing structure and replace each explicit `NOT RUN` measurement with observed values rather than estimates. Preserve the planning build evidence already recorded.

```markdown
# Validation: MVP scheduling performance optimization

The checked-in planning record already distinguishes verified local build evidence from authenticated measurements that were not run. T001 replaces those limitations with ten-run evidence before production-code changes.
```

- [ ] **Step 2: Run the production build baseline**

Run: `npm run build`

Expected: exit 0; record workspace route and middleware sizes. The planning values were 207 kB and 91.7 kB, but use the implementation worktree's fresh output as the baseline.

- [ ] **Step 3: Record ten browser runs for each flow**

Follow `specs/003-mvp-performance-optimization/quickstart.md` exactly. Do not record tokens, cookies, email, phone, address, room IDs, or schedule content.

Expected: every baseline table cell contains observed values or an explicit `NOT RUN — <reason>`; no blank or inferred pass remains.

- [ ] **Step 4: Commit the baseline only**

```bash
git add specs/003-mvp-performance-optimization/validation.md
git commit -m "docs: record scheduling performance baseline"
```

Expected: one commit containing only the validation record.

### Task 2: Remove complete workspace refreshes after mutations

**Files:**

- Create: `src/components/app/workspace-refresh-contract.test.mjs`
- Modify: `src/components/app/ScheduleWorkspace.tsx`
- Modify: `src/app/actions/schedule-actions.ts`
- Modify: `specs/003-mvp-performance-optimization/validation.md`

**Interfaces:**

- Consumes: existing Server Action result objects and local `setRooms`, `setSchedules`, `setTasks`, `setPreference`, and `setWorkspaceProfile` state updates.
- Produces: mutation handlers that never call `router.refresh()` and actions that never call the broad `revalidateApp()` helper.

- [ ] **Step 1: Write the failing refresh contract**

Create `src/components/app/workspace-refresh-contract.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceUrl = new URL('./ScheduleWorkspace.tsx', import.meta.url);
const actionsUrl = new URL('../../app/actions/schedule-actions.ts', import.meta.url);

test('workspace mutations do not force a complete route refresh', async () => {
  const source = await readFile(workspaceUrl, 'utf8');
  assert.doesNotMatch(source, /router\.refresh\(\)/);
});

test('schedule actions do not broadly revalidate dynamic workspace routes', async () => {
  const source = await readFile(actionsUrl, 'utf8');
  assert.doesNotMatch(source, /function revalidateApp\(/);
  assert.doesNotMatch(source, /revalidatePath\(/);
  assert.doesNotMatch(source, /from 'next\/cache'/);
});

test('optimistic checked and task toggles preserve rollback', async () => {
  const source = await readFile(workspaceUrl, 'utf8');
  assert.match(source, /const previousTasks = tasks;[\s\S]*?setTasks\(previousTasks\)/);
  assert.match(source, /const previousSchedules = schedules;[\s\S]*?setSchedules\(previousSchedules\)/);
});
```

- [ ] **Step 2: Run the contract and observe the intended failure**

Run:

```bash
node --no-warnings --experimental-strip-types --test src/components/app/workspace-refresh-contract.test.mjs
```

Expected: FAIL on the `router.refresh()`, `revalidateApp()`, `revalidatePath()`, and `next/cache` assertions; the rollback assertion may already pass.

- [ ] **Step 3: Remove refresh calls while preserving navigation and local updates**

In `src/components/app/ScheduleWorkspace.tsx`, delete all sixteen standalone `router.refresh();` statements. Keep every preceding `setRooms`, `setSchedules`, `setTasks`, `setPreference`, `setWorkspaceProfile`, rollback, `router.push(...)`, and error branch unchanged.

The invite and room-deletion endings must become:

```ts
setActiveSheet(null);
router.push(`/rooms/${result.roomId}`);
return { ok: true, message: '' };
```

```ts
setDeleteRoomOpen(false);
setActiveSheet(null);
router.push('/dashboard');
```

In `src/app/actions/schedule-actions.ts`, delete:

```ts
import { revalidatePath } from 'next/cache';

function revalidateApp() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/today');
  revalidatePath('/dashboard/preliminary');
  revalidatePath('/rooms');
  revalidatePath('/mypage');
}
```

Delete every `revalidateApp();` and `revalidatePath(...)` statement. Do not change database mutations or returned result objects.

- [ ] **Step 4: Run focused and affected tests**

Run:

```bash
node --no-warnings --experimental-strip-types --test src/components/app/workspace-refresh-contract.test.mjs src/components/app/dashboard-schedules.test.mjs src/data/repositories/invite-repository.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 5: Record the P1 checkpoint and commit**

Add the focused command, exit code, and one checked/task browser observation under `## Implementation checkpoints` in `validation.md`.

```bash
git add src/components/app/workspace-refresh-contract.test.mjs src/components/app/ScheduleWorkspace.tsx src/app/actions/schedule-actions.ts specs/003-mvp-performance-optimization/validation.md
git commit -m "perf: avoid redundant workspace refreshes"
```

### Task 3: Define Korean-day and page-scope contracts

**Files:**

- Modify: `src/lib/schedule-day.test.mjs`
- Modify: `src/lib/schedule-day.ts`
- Create: `src/data/schedule-workspace-query.test.mjs`
- Create: `src/data/schedule-workspace-query.ts`

**Interfaces:**

- Produces: `getKoreanDayBounds(referenceDate?: Date): { startAt: string; endAt: string }`.
- Produces: `buildWorkspaceQueryPlan(request: ScheduleWorkspaceRequest): WorkspaceQueryPlan`.
- Consumed by: Task 4 repository refactor and Task 5 route wiring.

- [ ] **Step 1: Add failing Korean-day bound tests**

Add `getKoreanDayBounds` to the existing import from `src/lib/schedule-day.ts`, then append:

```js
test('builds Korean calendar-day bounds across the UTC date boundary', () => {
  assert.deepEqual(getKoreanDayBounds(new Date('2026-07-19T16:30:00.000Z')), {
    startAt: '2026-07-19T15:00:00.000Z',
    endAt: '2026-07-20T15:00:00.000Z',
  });
});

test('keeps the previous Korean day before 09:00 UTC offset rollover', () => {
  assert.deepEqual(getKoreanDayBounds(new Date('2026-07-19T14:59:59.999Z')), {
    startAt: '2026-07-18T15:00:00.000Z',
    endAt: '2026-07-19T15:00:00.000Z',
  });
});
```

Run: `node --no-warnings --experimental-strip-types --test src/lib/schedule-day.test.mjs`

Expected: FAIL because `getKoreanDayBounds` is not exported.

- [ ] **Step 2: Implement deterministic Korean-day bounds**

Add to `src/lib/schedule-day.ts`:

```ts
const koreanDateFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getKoreanDayBounds(referenceDate = new Date()) {
  const values = Object.fromEntries(
    koreanDateFormatter
      .formatToParts(referenceDate)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day', string>;
  const start = new Date(`${values.year}-${values.month}-${values.day}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 86_400_000);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}
```

Run the test again. Expected: all existing and new schedule-day tests pass.

- [ ] **Step 3: Write the complete failing query-plan test**

Create `src/data/schedule-workspace-query.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspaceQueryPlan } from './schedule-workspace-query.ts';

const cases = [
  ['dashboard', { rooms: 'all', schedules: 'all', participants: true, states: true, tasks: true, preference: false }],
  ['todayTasks', { rooms: 'all', schedules: 'today', participants: true, states: true, tasks: false, preference: false }],
  ['preliminaryTasks', { rooms: 'all', schedules: 'none', participants: false, states: false, tasks: true, preference: false }],
  ['rooms', { rooms: 'all', schedules: 'summary', participants: false, states: false, tasks: false, preference: false }],
  ['mypage', { rooms: 'all', schedules: 'none', participants: false, states: false, tasks: false, preference: true }],
];

for (const [page, expected] of cases) {
  test(`${page} uses only its allowed data categories`, () => {
    assert.deepEqual(buildWorkspaceQueryPlan({ page }), expected);
  });
}

test('room detail requires and preserves its target room', () => {
  assert.deepEqual(buildWorkspaceQueryPlan({ page: 'room', roomId: 'room-1' }), {
    rooms: 'one',
    roomId: 'room-1',
    schedules: 'room',
    participants: true,
    states: true,
    tasks: false,
    preference: false,
  });
  assert.throws(() => buildWorkspaceQueryPlan({ page: 'room' }), /roomId/);
});
```

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-workspace-query.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement the pure query plan**

Create `src/data/schedule-workspace-query.ts`:

```ts
export type ScheduleWorkspacePage =
  | 'dashboard'
  | 'todayTasks'
  | 'preliminaryTasks'
  | 'rooms'
  | 'room'
  | 'mypage';

export interface ScheduleWorkspaceRequest {
  page: ScheduleWorkspacePage;
  roomId?: string;
  referenceDate?: Date;
}

export type WorkspaceQueryPlan = {
  rooms: 'all' | 'one';
  roomId?: string;
  schedules: 'all' | 'today' | 'summary' | 'room' | 'none';
  participants: boolean;
  states: boolean;
  tasks: boolean;
  preference: boolean;
};

export function buildWorkspaceQueryPlan(request: ScheduleWorkspaceRequest): WorkspaceQueryPlan {
  switch (request.page) {
    case 'dashboard':
      return { rooms: 'all', schedules: 'all', participants: true, states: true, tasks: true, preference: false };
    case 'todayTasks':
      return { rooms: 'all', schedules: 'today', participants: true, states: true, tasks: false, preference: false };
    case 'preliminaryTasks':
      return { rooms: 'all', schedules: 'none', participants: false, states: false, tasks: true, preference: false };
    case 'rooms':
      return { rooms: 'all', schedules: 'summary', participants: false, states: false, tasks: false, preference: false };
    case 'room':
      if (!request.roomId) throw new Error('roomId is required for the room workspace scope.');
      return { rooms: 'one', roomId: request.roomId, schedules: 'room', participants: true, states: true, tasks: false, preference: false };
    case 'mypage':
      return { rooms: 'all', schedules: 'none', participants: false, states: false, tasks: false, preference: true };
  }
}
```

Run query-plan and schedule-day tests. Expected: all pass.

- [ ] **Step 5: Commit the pure contracts**

```bash
git add src/lib/schedule-day.ts src/lib/schedule-day.test.mjs src/data/schedule-workspace-query.ts src/data/schedule-workspace-query.test.mjs
git commit -m "test: define workspace query scopes"
```

### Task 4: Execute page-scoped explicit-column reads

**Files:**

- Create: `src/data/schedule-supabase.test.mjs`
- Modify: `src/data/schedule-supabase.ts`

**Interfaces:**

- Consumes: `ScheduleWorkspaceRequest`, `WorkspaceQueryPlan`, and `getKoreanDayBounds()` from Task 3.
- Produces: `getScheduleWorkspaceData(profile, request): Promise<ScheduleWorkspaceInitialData>`.

- [ ] **Step 1: Write the failing loader source contract**

Create `src/data/schedule-supabase.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('./schedule-supabase.ts', import.meta.url);

test('workspace loader uses explicit columns and page query plans', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.doesNotMatch(source, /select\(['"]\*['"]\)/);
  assert.match(source, /buildWorkspaceQueryPlan\(request\)/);
  assert.match(source, /getKoreanDayBounds\(request\.referenceDate\)/);
  assert.match(source, /\.lt\('start_at', endAt\)/);
  assert.match(source, /\.gt\('end_at', startAt\)/);
  assert.match(source, /plan\.schedules === 'none'/);
  assert.match(source, /plan\.participants/);
  assert.match(source, /plan\.states/);
  assert.match(source, /plan\.tasks/);
  assert.match(source, /plan\.preference/);
});

test('room detail filters the room query before schedule discovery', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /plan\.rooms === 'one'[\s\S]*?\.eq\('id', plan\.roomId/);
  assert.match(source, /\.in\('room_id', roomIds\)/);
});
```

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-supabase.test.mjs`

Expected: FAIL on wildcard, query-plan, Korean-day, and conditional query assertions.

- [ ] **Step 2: Add exact column contracts and request input**

At the top of `src/data/schedule-supabase.ts`, import the new contracts and add constants:

```ts
import { getKoreanDayBounds } from '@/lib/schedule-day';
import {
  buildWorkspaceQueryPlan,
  type ScheduleWorkspaceRequest,
} from '@/data/schedule-workspace-query';

const ROOM_COLUMNS = 'id, name, description, color, shared_schedule_color, owner_user_id, status, default_view, business_start_time, business_end_time, updated_at';
const MEMBER_COLUMNS = 'id, room_id, user_id, nickname, role, color, joined_at, last_active_at';
const SCHEDULE_COLUMNS = 'id, room_id, title, start_at, end_at, address, customer_phone, estimated_price, additional_info, status, created_by_member_id, updated_at';
const SCHEDULE_SUMMARY_COLUMNS = 'id, room_id, title, start_at, end_at';
const PARTICIPANT_COLUMNS = 'schedule_id, room_member_id';
const STATE_COLUMNS = 'schedule_id, user_id, is_checked';
const TASK_COLUMNS = 'id, user_id, room_id, title, memo, priority, due_date, is_completed';
const PREFERENCE_COLUMNS = 'user_id, push_enabled, default_calendar_view, filter_opacity';
```

Change the signature to:

```ts
export async function getScheduleWorkspaceData(
  profile: Profile,
  request: ScheduleWorkspaceRequest,
): Promise<ScheduleWorkspaceInitialData> {
```

The first statement inside `try` after client creation must be:

```ts
const plan = buildWorkspaceQueryPlan(request);
```

- [ ] **Step 3: Replace the unconditional query sequence with the plan**

Use these exact rules in the existing mapper flow:

```ts
let roomQuery = supabase.from('scheduling_rooms').select(ROOM_COLUMNS);
if (plan.rooms === 'one') roomQuery = roomQuery.eq('id', plan.roomId!);
const { data: roomData, error: roomError } = await roomQuery.order('updated_at', { ascending: false });
if (roomError) throw roomError;

const roomRows = (roomData ?? []) as RoomRow[];
const roomIds = roomRows.map((room) => room.id);

const memberPromise = roomIds.length > 0
  ? supabase.from('room_members').select(MEMBER_COLUMNS).in('room_id', roomIds)
  : Promise.resolve({ data: [] });

let schedulePromise: PromiseLike<{ data: unknown[] | null }> = Promise.resolve({ data: [] });
if (roomIds.length > 0 && plan.schedules !== 'none') {
  let scheduleQuery = supabase
    .from('schedules')
    .select(plan.schedules === 'summary' ? SCHEDULE_SUMMARY_COLUMNS : SCHEDULE_COLUMNS)
    .in('room_id', roomIds);
  if (plan.schedules === 'today') {
    const { startAt, endAt } = getKoreanDayBounds(request.referenceDate);
    scheduleQuery = scheduleQuery.lt('start_at', endAt).gt('end_at', startAt);
  }
  schedulePromise = scheduleQuery.order('start_at', { ascending: true });
}

const taskPromise = plan.tasks
  ? supabase.from('preliminary_tasks').select(TASK_COLUMNS).eq('user_id', profile.id).order('created_at', { ascending: false })
  : Promise.resolve({ data: [] });
const preferencePromise = plan.preference
  ? supabase.from('user_preferences').select(PREFERENCE_COLUMNS).eq('user_id', profile.id).single()
  : Promise.resolve({ data: null });

const [{ data: memberData }, { data: rawScheduleData }, { data: taskData }, { data: preferenceData }] = await Promise.all([
  memberPromise,
  schedulePromise,
  taskPromise,
  preferencePromise,
]);
```

For `plan.schedules === 'summary'`, use the rows only to compute `todayScheduleCount`, `nextSchedule`, and `recentActivity`, and return `schedules: []`. For `all`, `today`, and `room`, map full schedule rows exactly as the current implementation does.

Only query `schedule_participants` when `plan.participants && scheduleIds.length > 0`, and only query `schedule_user_states` when `plan.states && scheduleIds.length > 0`. Use `PARTICIPANT_COLUMNS` and `STATE_COLUMNS`.

Do not change the current catch fallback or the existing row-to-domain field mapping.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
node --no-warnings --experimental-strip-types --test src/data/schedule-supabase.test.mjs src/data/schedule-workspace-query.test.mjs src/lib/schedule-day.test.mjs
npm run typecheck
```

Expected: all tests pass and TypeScript exits 0. If Supabase builder typing rejects the `PromiseLike` annotation, replace the annotation with a small local `async function loadSchedules()` returning `{ data: unknown[] }`; do not use `any` or weaken the generated database types.

- [ ] **Step 5: Commit the repository slice**

```bash
git add src/data/schedule-supabase.ts src/data/schedule-supabase.test.mjs
git commit -m "perf: scope workspace data queries"
```

### Task 5: Wire every workspace route to its explicit scope

**Files:**

- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/today/page.tsx`
- Modify: `src/app/dashboard/preliminary/page.tsx`
- Modify: `src/app/rooms/page.tsx`
- Modify: `src/app/rooms/[roomId]/page.tsx`
- Modify: `src/app/mypage/page.tsx`
- Modify: `src/components/app/ScheduleWorkspace.tsx`

**Interfaces:**

- Consumes: `ScheduleWorkspacePage` and the new two-argument workspace loader.
- Produces: one validated scope per route with no implicit default.

- [ ] **Step 1: Make the current one-argument calls fail typecheck**

Run: `npm run typecheck`

Expected: FAIL at all six `getScheduleWorkspaceData(profile)` call sites because `request` is required.

- [ ] **Step 2: Pass exact scopes from pages**

Use these exact replacements:

```ts
getScheduleWorkspaceData(profile, { page: 'dashboard' })
getScheduleWorkspaceData(profile, { page: 'todayTasks' })
getScheduleWorkspaceData(profile, { page: 'preliminaryTasks' })
getScheduleWorkspaceData(profile, { page: 'rooms' })
getScheduleWorkspaceData(profile, { page: 'mypage' })
```

In `src/app/rooms/[roomId]/page.tsx`, use:

```ts
const [{ roomId }, profile] = await Promise.all([params, getCurrentProfile()]);
const initialData = await getScheduleWorkspaceData(profile, { page: 'room', roomId });
```

In `ScheduleWorkspace.tsx`, import `type ScheduleWorkspacePage` from `@/data/schedule-workspace-query` and replace the private `WorkspacePage` type. The prop must become:

```ts
page: ScheduleWorkspacePage;
```

- [ ] **Step 3: Run route-related tests, typecheck, and build**

Run:

```bash
node --no-warnings --experimental-strip-types --test src/data/schedule-supabase.test.mjs src/data/schedule-workspace-query.test.mjs src/components/app/dashboard-schedules.test.mjs
npm run typecheck
npm run build
```

Expected: every command exits 0; all six workspace routes remain dynamic and no route exceeds the fresh implementation baseline size.

- [ ] **Step 4: Record the P2 checkpoint and commit**

Record observed table requests for all six routes in `validation.md`.

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/today/page.tsx src/app/dashboard/preliminary/page.tsx src/app/rooms/page.tsx 'src/app/rooms/[roomId]/page.tsx' src/app/mypage/page.tsx src/components/app/ScheduleWorkspace.tsx specs/003-mvp-performance-optimization/validation.md
git commit -m "perf: load workspace data by page scope"
```

### Task 6: Use verified claims and bypass public middleware work

**Files:**

- Create: `src/lib/auth/verified-identity.test.mjs`
- Create: `src/lib/auth/verified-identity.ts`
- Modify: `src/middleware.ts`
- Modify: `src/lib/auth.ts`
- Test: `src/lib/auth/middleware-access.test.mjs`

**Interfaces:**

- Produces: `getVerifiedIdentity(client): Promise<VerifiedIdentity | null>`.
- Consumed by: middleware and `getCurrentProfile()`.

- [ ] **Step 1: Write failing verified-identity and source-boundary tests**

Create `src/lib/auth/verified-identity.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getVerifiedIdentity } from './verified-identity.ts';

function claimsClient(result) {
  return { auth: { async getClaims() { return result; } } };
}

test('returns subject and email only from verified claims', async () => {
  const identity = await getVerifiedIdentity(claimsClient({
    data: { claims: { sub: 'user-1', email: 'user@example.com' } },
    error: null,
  }));
  assert.deepEqual(identity, { userId: 'user-1', email: 'user@example.com' });
});

test('rejects claim errors and missing subjects', async () => {
  assert.equal(await getVerifiedIdentity(claimsClient({ data: null, error: new Error('invalid') })), null);
  assert.equal(await getVerifiedIdentity(claimsClient({ data: { claims: { email: 'user@example.com' } }, error: null })), null);
});

test('allows a verified subject without an email display claim', async () => {
  assert.deepEqual(await getVerifiedIdentity(claimsClient({
    data: { claims: { sub: 'user-1' } },
    error: null,
  })), { userId: 'user-1', email: '' });
});

test('protected UI sources no longer call getUser and middleware has a public fast path', async () => {
  const middleware = await readFile(new URL('../../middleware.ts', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../auth.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(middleware, /auth\.getUser\(/);
  assert.doesNotMatch(auth, /auth\.getUser\(/);
  assert.match(middleware, /if \(!protectedPath\) return response;/);
  assert.match(middleware, /getVerifiedIdentity\(supabase/);
  assert.match(auth, /getVerifiedIdentity\(supabase/);
});
```

Run: `node --no-warnings --experimental-strip-types --test src/lib/auth/verified-identity.test.mjs`

Expected: FAIL because the helper does not exist and both sources still call `getUser()`.

- [ ] **Step 2: Implement the verified claim adapter**

Create `src/lib/auth/verified-identity.ts`:

```ts
type ClaimResult = {
  data: { claims?: { sub?: unknown; email?: unknown } } | null;
  error: unknown;
};

export type ClaimsAuthClient = {
  auth: {
    getClaims(): Promise<ClaimResult>;
  };
};

export interface VerifiedIdentity {
  userId: string;
  email: string;
}

export async function getVerifiedIdentity(client: ClaimsAuthClient): Promise<VerifiedIdentity | null> {
  const { data, error } = await client.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== 'string' || subject.length === 0) return null;
  const email = data?.claims?.email;
  return {
    userId: subject,
    email: typeof email === 'string' ? email : '',
  };
}
```

- [ ] **Step 3: Apply the public fast path and verified identity in middleware**

Import `getVerifiedIdentity` and `ClaimsAuthClient`. Immediately after computing `protectedPath`, before environment lookup or Supabase client creation, add:

```ts
if (!protectedPath) return response;
```

Replace:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!protectedPath) return response;
if (!user) {
```

with:

```ts
const identity = await getVerifiedIdentity(supabase as unknown as ClaimsAuthClient);
if (!identity) {
```

Replace each subsequent `user.id` in middleware with `identity.userId`. Do not change `evaluateMiddlewareAccess`, profile columns, sign-out behavior, response cookies, API error bodies, redirects, or activity-touch cadence.

- [ ] **Step 4: Apply verified identity and explicit profile fields in the page loader**

In `src/lib/auth.ts`, import the helper and replace the initial `getUser()` block with:

```ts
const identity = await getVerifiedIdentity(supabase as unknown as ClaimsAuthClient);
if (!identity) redirect('/login');
```

Change the profile query to:

```ts
supabase
  .from('profiles')
  .select('id, display_name, account_state, session_started_at, last_seen_at, last_login_at')
  .eq('id', identity.userId)
  .single()
```

Change the role query user ID and returned email:

```ts
.eq('user_id', identity.userId)
```

```ts
email: identity.email,
```

Keep existing missing-profile, account-state, session-age, role, and completion redirects unchanged.

- [ ] **Step 5: Run focused and security tests**

Run:

```bash
node --no-warnings --experimental-strip-types --test src/lib/auth/verified-identity.test.mjs src/lib/auth/middleware-access.test.mjs src/lib/auth/account-access.test.mjs src/lib/admin/admin-security-contract.test.mjs
npm run typecheck
npm run test:security
```

Expected: all commands exit 0. If the real Supabase return type is wider than `ClaimResult`, widen only the `claims` value fields to `unknown`; do not switch the helper or call sites to `any`.

- [ ] **Step 6: Record the P3 checkpoint and commit**

Record public-path and protected-path identity-service request counts plus all denial outcomes in `validation.md`.

```bash
git add src/lib/auth/verified-identity.ts src/lib/auth/verified-identity.test.mjs src/middleware.ts src/lib/auth.ts specs/003-mvp-performance-optimization/validation.md
git commit -m "perf: verify auth identity from claims"
```

### Task 7: Run full verification and acceptance measurement

**Files:**

- Modify: `specs/003-mvp-performance-optimization/validation.md`
- Modify: `specs/003-mvp-performance-optimization/tasks.md`

**Interfaces:**

- Consumes: all three completed slices and Task 1 baseline.
- Produces: evidence-backed accept/reject status for SC-001 through SC-008.

- [ ] **Step 1: Run every automated gate fresh**

```bash
npm run test:unit
npm run test:security
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0. Record command, date, exit code, test totals, and build route sizes in `validation.md`; do not summarize a command as passing if its output is unavailable.

- [ ] **Step 2: Repeat the authenticated browser sample**

Run the same browser, deployment, test-data shape, network profile, and seven flows used in Task 1. Record ten final samples per flow and calculate medians.

Expected:

- At least nine of ten successful checked/task updates have no complete workspace request.
- Mutation median stable-state time improves at least 30%.
- Today, preliminary, and mypage page-data bytes each improve at least 30%.
- Four of six core pages improve useful-content median at least 20%.
- No core page regresses more than 5%.
- Every security decision matches baseline.
- Workspace First Load JS does not exceed the fresh implementation baseline.

- [ ] **Step 3: Mark only evidenced tasks complete**

In `specs/003-mvp-performance-optimization/tasks.md`, change `[ ]` to `[x]` only for tasks whose test, command, or browser evidence appears in `validation.md`. Leave blocked measurements unchecked and state the exact limitation.

- [ ] **Step 4: Run the Spec Kit artifact audit**

Review `spec.md`, `plan.md`, and `tasks.md` against the constitution. Confirm every FR/SC maps to at least one completed task or validation record, no implementation exceeded Out of Scope, and no generated unrelated file is included.

Expected: zero CRITICAL or HIGH consistency findings before implementation handoff is declared complete.

- [ ] **Step 5: Commit the final evidence**

```bash
git add specs/003-mvp-performance-optimization/validation.md specs/003-mvp-performance-optimization/tasks.md
git commit -m "docs: validate scheduling performance optimization"
```

Expected: the worktree is clean except for explicitly documented user-owned changes, and no migration, dependency, cache, or unrelated refactor appears in the feature diff.

## Self-review record

- Spec coverage: FR-001–FR-002 map to Task 2; FR-003–FR-009 map to Tasks 3–5; FR-010–FR-013 map to Task 6; FR-014–FR-017 and SC-001–SC-008 map to Tasks 1 and 7.
- Placeholder scan: no `TBD`, `TODO`, `implement later`, undefined signature, or unresolved clarification remains.
- Type consistency: `ScheduleWorkspaceRequest`, `WorkspaceQueryPlan`, `getKoreanDayBounds`, `ClaimsAuthClient`, `VerifiedIdentity`, and `getVerifiedIdentity` use the same names in producers and consumers.
- Scope check: database migration, new dependency, shared cache, calendar pagination, and workspace decomposition are expressly excluded.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-20-mvp-performance-optimization.md`.

When implementation is authorized, choose one execution mode:

1. **Subagent-Driven** — use `superpowers:subagent-driven-development` with a fresh implementer and review gate per task.
2. **Inline Execution** — use `superpowers:executing-plans` in the isolated worktree with checkpoints after Tasks 2, 5, and 6.
