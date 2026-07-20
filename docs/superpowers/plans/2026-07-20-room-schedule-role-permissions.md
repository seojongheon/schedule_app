# Room Schedule Role Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make schedule ownership explicit so members can manage their own schedules, owners and managers can create schedules for eligible members, only owners can manage membership, and owner/manager invitation links work.

**Architecture:** Add pure TypeScript permission helpers for UI decisions and security-definer PostgreSQL RPCs for authoritative mutations. A migration adds schedule ownership/name snapshots, backfills existing data, makes creator references removable, performs atomic save/delete/kick operations, and repairs the invitation event constraint. Server actions become thin RPC adapters and the workspace renders controls from the shared permission helpers.

**Tech Stack:** Next.js 15, React 19, TypeScript, Node test runner, Supabase Auth/PostgREST/PostgreSQL, PL/pgSQL

## Global Constraints

- Owners and managers may create schedules owned by an owner, manager, or member in the same room.
- Members may create, edit, and delete only schedules they own.
- Schedule owners alone may edit schedules.
- Owners and managers may additionally delete schedules currently owned by a `member`, but not schedules owned by another owner or manager.
- Viewers cannot own, create, edit, or delete schedules.
- Owners and managers may create, replace, and revoke invite links; members and viewers may not.
- Only owners may kick members, change manager status, transfer ownership, or delete rooms.
- Kicking a non-owner transfers their schedules to the room owner while preserving the kicked member's displayed owner name.
- Schedule writes and kicks must be atomic database operations; UI checks are not authorization boundaries.

---

## File Structure

- Create: `src/domain/authorization/schedule-permissions.ts` — pure role and schedule permission decisions used by the UI.
- Create: `src/domain/authorization/schedule-permissions.test.mjs` — exhaustive permission matrix tests.
- Create: `src/data/schedule-ownership-contract.test.mjs` — SQL, server-action, loader, and UI contract tests.
- Create: `supabase/migrations/20260720190000_add_schedule_ownership_permissions.sql` — schema backfill, protected RPCs, membership cleanup, and invite constraint repair.
- Modify: `src/domain/authorization/capabilities.ts` and `src/domain/authorization/capabilities.test.mjs` — remove manager membership-management capability.
- Modify: `src/domain/entities.ts` and `src/data/database.types.ts` — expose ownership fields and RPC signatures.
- Modify: `src/data/schedule-supabase.ts` — select and map schedule ownership/name snapshots.
- Modify: `src/app/actions/schedule-actions.ts` — delegate schedule save/delete/status and kick to RPCs.
- Modify: `src/components/app/ScheduleWorkspace.tsx` — owner selector, member self-only form, button gating, labels, and local state alignment.
- Modify: `src/lib/mock-data.ts` — populate ownership fields for demo schedules.

### Task 1: Pure schedule permission model

**Files:**
- Create: `src/domain/authorization/schedule-permissions.ts`
- Create: `src/domain/authorization/schedule-permissions.test.mjs`
- Modify: `src/domain/authorization/capabilities.ts`
- Modify: `src/domain/authorization/capabilities.test.mjs`

**Interfaces:**
- Consumes: `RoomRole` from `src/domain/entities.ts`.
- Produces: `canCreateSchedule`, `canAssignScheduleOwner`, `canEditSchedule`, `canDeleteSchedule`, and `canManageMembership`.

- [ ] **Step 1: Write failing permission tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAssignScheduleOwner,
  canCreateSchedule,
  canDeleteSchedule,
  canEditSchedule,
  canManageMembership,
} from './schedule-permissions.ts';

test('members create and edit only their own schedules', () => {
  assert.equal(canCreateSchedule('member'), true);
  assert.equal(canAssignScheduleOwner('member', 'member-a', 'member-a', 'member'), true);
  assert.equal(canAssignScheduleOwner('member', 'member-a', 'member-b', 'member'), false);
  assert.equal(canEditSchedule('member-a', 'member-a'), true);
  assert.equal(canEditSchedule('member-a', 'member-b'), false);
});

test('owners and managers may assign eligible owners but cannot delete peer schedules', () => {
  for (const role of ['owner', 'manager']) {
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'owner'), true);
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'manager'), true);
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'member'), true);
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'viewer'), false);
    assert.equal(canDeleteSchedule(role, 'actor', 'target', 'member'), true);
    assert.equal(canDeleteSchedule(role, 'actor', 'target', 'manager'), false);
    assert.equal(canDeleteSchedule(role, 'actor', 'target', 'owner'), false);
    assert.equal(canDeleteSchedule(role, 'actor', 'actor', role), true);
  }
});

test('only owners manage membership and viewers remain read only', () => {
  assert.equal(canManageMembership('owner'), true);
  assert.equal(canManageMembership('manager'), false);
  assert.equal(canCreateSchedule('viewer'), false);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --no-warnings --experimental-strip-types --test src/domain/authorization/schedule-permissions.test.mjs`

Expected: FAIL because `schedule-permissions.ts` does not exist.

- [ ] **Step 3: Implement the pure helpers and tighten the room matrix**

```ts
import type { RoomRole } from '@/domain/entities';

export function canCreateSchedule(role?: RoomRole) {
  return role === 'owner' || role === 'manager' || role === 'member';
}

export function canAssignScheduleOwner(
  actorRole: RoomRole | undefined,
  actorMemberId: string,
  targetMemberId: string,
  targetRole: RoomRole,
) {
  if (targetRole === 'viewer') return false;
  if (actorRole === 'owner' || actorRole === 'manager') return true;
  return actorRole === 'member' && actorMemberId === targetMemberId;
}

export function canEditSchedule(actorMemberId: string, ownerMemberId: string) {
  return actorMemberId === ownerMemberId;
}

export function canDeleteSchedule(
  actorRole: RoomRole | undefined,
  actorMemberId: string,
  ownerMemberId: string,
  ownerRole: RoomRole | undefined,
) {
  return actorMemberId === ownerMemberId
    || ((actorRole === 'owner' || actorRole === 'manager') && ownerRole === 'member');
}

export function canManageMembership(role?: RoomRole) {
  return role === 'owner';
}
```

Remove `member.manage` from the manager entry in `ROOM_CAPABILITY_MATRIX`; keep `invite.create` and schedule capabilities.

- [ ] **Step 4: Run permission tests and verify GREEN**

Run: `node --no-warnings --experimental-strip-types --test src/domain/authorization/schedule-permissions.test.mjs src/domain/authorization/capabilities.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the permission model**

```bash
git add src/domain/authorization/schedule-permissions.ts src/domain/authorization/schedule-permissions.test.mjs src/domain/authorization/capabilities.ts src/domain/authorization/capabilities.test.mjs
git commit -m "feat: define schedule ownership permissions"
```

### Task 2: Database ownership migration and atomic authorization

**Files:**
- Create: `supabase/migrations/20260720190000_add_schedule_ownership_permissions.sql`
- Create: `src/data/schedule-ownership-contract.test.mjs`

**Interfaces:**
- Produces RPCs `save_room_schedule`, `delete_room_schedule`, `update_room_schedule_status`, and `kick_room_member`.
- Produces `schedules.owner_member_id`, `owner_name_snapshot`, nullable `created_by_member_id`, and `created_by_name_snapshot`.

- [ ] **Step 1: Write a failing SQL contract test**

The test must read the new migration and assert all of these exact contracts:

```js
assert.match(sql, /add column owner_member_id uuid/i);
assert.match(sql, /add column owner_name_snapshot text/i);
assert.match(sql, /add column created_by_name_snapshot text/i);
assert.match(sql, /foreign key \(created_by_member_id\)[\s\S]*on delete set null/i);
assert.match(sql, /create or replace function public\.save_room_schedule\(/i);
assert.match(sql, /create or replace function public\.delete_room_schedule\(/i);
assert.match(sql, /create or replace function public\.update_room_schedule_status\(/i);
assert.match(sql, /create or replace function public\.kick_room_member\(/i);
assert.match(sql, /v_actor_role = 'member'[\s\S]*p_owner_member_id <> v_actor_member_id/i);
assert.match(sql, /v_owner_role = 'member'/i);
assert.match(sql, /set owner_member_id = v_owner_member_id[\s\S]*owner_name_snapshot/i);
assert.match(sql, /event_type in \('preview', 'validate', 'redeem', 'create', 'revoke', 'replace', 'deny'\)/i);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-ownership-contract.test.mjs`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the additive migration**

The migration must perform these operations in order:

1. Add nullable ownership and snapshot columns.
2. Backfill ownership from `created_by_member_id` and nicknames; for rows without a surviving creator, use the current room owner.
3. Replace the creator foreign key with `on delete set null`, then make ownership/snapshot columns non-null.
4. Add same-room ownership validation and immutable ownership triggers.
5. Replace direct authenticated schedule/participant mutations with the four security-definer RPCs.
6. In `save_room_schedule`, lock actor/owner rows, enforce the role matrix, keep the owner among participants, and replace participants in the same transaction.
7. In `delete_room_schedule`, allow the owner or an owner/manager deleting a `member`-owned schedule.
8. In `update_room_schedule_status`, allow only the schedule owner.
9. In `kick_room_member`, require the room owner, transfer ownership to that owner without changing `owner_name_snapshot`, guarantee owner participation, then delete the target membership.
10. Expand `invitation_attempts_event_type_check` with all seven compatible values and grant only the required RPC executions to `authenticated`.

- [ ] **Step 4: Run the SQL contract and security tests**

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-ownership-contract.test.mjs src/data/repositories/security-repository.test.mjs src/data/repositories/invite-repository.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the migration**

```bash
git add supabase/migrations/20260720190000_add_schedule_ownership_permissions.sql src/data/schedule-ownership-contract.test.mjs
git commit -m "feat: enforce schedule ownership in database"
```

### Task 3: Type, loader, and server-action integration

**Files:**
- Modify: `src/domain/entities.ts`
- Modify: `src/data/database.types.ts`
- Modify: `src/data/schedule-supabase.ts`
- Modify: `src/app/actions/schedule-actions.ts`
- Modify: `src/lib/mock-data.ts`
- Test: `src/data/schedule-ownership-contract.test.mjs`

**Interfaces:**
- `Schedule.createdByMemberId: string | null`
- `Schedule.createdByName: string`
- `Schedule.ownerMemberId: string`
- `Schedule.ownerName: string`
- `saveScheduleAction` consumes `ownerMemberId` in addition to existing fields.

- [ ] **Step 1: Extend the failing contract test**

Assert that the loader selects and maps all four ownership fields and that actions call only the new RPCs:

```js
assert.match(loader, /owner_member_id,owner_name_snapshot,created_by_member_id,created_by_name_snapshot/);
assert.match(actions, /rpc\('save_room_schedule'/);
assert.match(actions, /rpc\('delete_room_schedule'/);
assert.match(actions, /rpc\('update_room_schedule_status'/);
assert.match(actions, /rpc\('kick_room_member'/);
assert.doesNotMatch(actions, /from\('schedule_participants'\)\.delete/);
assert.doesNotMatch(actions, /from\('room_members'\)\.delete/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-ownership-contract.test.mjs`

Expected: FAIL on missing fields and RPC calls.

- [ ] **Step 3: Update types, loader, fixtures, and actions**

Map database rows to the exact entity fields above. Add the four RPC definitions to `Database['public']['Functions']`. Replace the direct schedule/participant sequence in `saveScheduleAction`, the direct schedule delete, the direct status update, and the direct member delete with one RPC call each. Preserve existing `ActionResult` error handling.

- [ ] **Step 4: Run focused tests and type checking**

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-ownership-contract.test.mjs src/data/schedule-supabase.test.mjs src/components/app/dashboard-schedules.test.mjs && npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the integration**

```bash
git add src/domain/entities.ts src/data/database.types.ts src/data/schedule-supabase.ts src/app/actions/schedule-actions.ts src/lib/mock-data.ts src/data/schedule-ownership-contract.test.mjs
git commit -m "feat: integrate schedule ownership RPCs"
```

### Task 4: Role-aware schedule and membership UI

**Files:**
- Modify: `src/components/app/ScheduleWorkspace.tsx`
- Test: `src/data/schedule-ownership-contract.test.mjs`

**Interfaces:**
- Consumes the pure permission helpers from Task 1 and ownership fields from Task 3.
- `ScheduleFormValues.ownerMemberId: string` is always submitted.

- [ ] **Step 1: Add failing UI contract assertions**

```js
assert.match(workspace, /canCreateSchedule/);
assert.match(workspace, /canAssignScheduleOwner/);
assert.match(workspace, /canEditSchedule/);
assert.match(workspace, /canDeleteSchedule/);
assert.match(workspace, /name="ownerMemberId"/);
assert.match(workspace, /schedule\.ownerName/);
assert.match(workspace, /canManageMembership/);
assert.doesNotMatch(workspace, /function roleCanManageSchedules/);
```

- [ ] **Step 2: Run the UI contract and verify RED**

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-ownership-contract.test.mjs`

Expected: FAIL because the workspace still uses `roleCanManageSchedules` and has no owner selector.

- [ ] **Step 3: Implement the role-aware UI**

- Show “새 일정 추가” for owner, manager, and member.
- For owner/manager creation, render an owner selector containing only owner/manager/member roles.
- For member creation, submit the current member as a hidden owner and lock participants to that member.
- On edit, keep `ownerMemberId` fixed and show only the owner as authorized editor.
- Gate delete with `canDeleteSchedule` using the current owner member role.
- Display `schedule.ownerName` and `schedule.createdByName` snapshots in detail.
- Keep participant/role management, transfer, kick, and room deletion owner-only.
- Keep invite management owner/manager-only.
- After a successful kick, update local schedules to the room owner's `ownerMemberId` while retaining `ownerName` and removing the kicked participant.

- [ ] **Step 4: Run UI contracts, type check, and lint**

Run: `node --no-warnings --experimental-strip-types --test src/data/schedule-ownership-contract.test.mjs src/domain/authorization/schedule-permissions.test.mjs && npm run typecheck && npm run lint`

Expected: PASS with no warnings or errors.

- [ ] **Step 5: Commit the UI**

```bash
git add src/components/app/ScheduleWorkspace.tsx src/data/schedule-ownership-contract.test.mjs
git commit -m "feat: expose role-aware schedule controls"
```

### Task 5: Full verification and operational handoff

**Files:**
- Modify: `PROJECT_PLAYBOOK.md`
- Verify: all changed files

**Interfaces:**
- Produces a migration-ready feature with documented checks and no secret values.

- [ ] **Step 1: Run the full automated verification**

Run: `npm run test:unit && npm run typecheck && npm run lint && npm run build`

Expected: 0 test failures, 0 type errors, 0 lint errors, successful production build.

- [ ] **Step 2: Review the complete diff against the design**

Run: `git diff main...HEAD --check && git diff main...HEAD --stat`

Expected: only the planned domain, migration, type, loader, action, UI, test, and playbook files.

- [ ] **Step 3: Document the deployment check**

Append a playbook entry that records the migration name and manually verifies member self-scheduling, manager delegated creation, protected peer deletion, owner-only kick, preserved kicked-member name, and owner/manager invite creation after the migration is applied.

- [ ] **Step 4: Commit any final documentation-only adjustment**

```bash
git add PROJECT_PLAYBOOK.md
git commit -m "docs: add schedule ownership rollout checks"
```
