# Contract: Workspace performance boundaries

## Scope input

The server workspace loader accepts exactly one page scope:

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
```

Validation rules:

- `roomId` is required when `page === 'room'`.
- `roomId` is ignored or rejected for every other page.
- `referenceDate` is used only to make Korean-day overlap deterministic and defaults to the current request time.

## Loader result

The existing result shape remains stable:

```ts
export interface ScheduleWorkspaceInitialData {
  rooms: SchedulingRoom[];
  schedules: Schedule[];
  tasks: PreliminaryTask[];
  preference?: UserPreference;
}

export async function getScheduleWorkspaceData(
  profile: Profile,
  request: ScheduleWorkspaceRequest,
): Promise<ScheduleWorkspaceInitialData>;
```

Excluded categories return empty arrays or an absent preference and issue no corresponding database query.

## Query boundaries

All workspace selects list consumed columns explicitly. The following queries are forbidden for this feature:

- `select('*')` in `src/data/schedule-supabase.ts`.
- schedules on preliminary or mypage.
- preliminary tasks on today, rooms, room detail, or mypage.
- schedule participants or schedule user state on rooms, preliminary, or mypage.
- schedules belonging to rooms other than the requested room on room detail.

Today overlap is expressed as an exclusive interval:

```text
start_at < koreanDayEnd AND end_at > koreanDayStart
```

## Mutation boundary

Routine mutation handlers must not call `router.refresh()` after a successful Server Action when the result is already applied to client state. Workspace Server Actions must not call the broad `revalidateApp()` helper.

For optimistic toggles:

1. Capture the previous collection.
2. Apply the visible next value.
3. Await the Server Action.
4. Restore the previous collection if the result is not successful.
5. Show the existing actionable message.

## Identity boundary

```ts
export interface VerifiedIdentity {
  userId: string;
  email: string;
}

export async function getVerifiedIdentity(
  client: ClaimsAuthClient,
): Promise<VerifiedIdentity | null>;
```

The function calls `client.auth.getClaims()`, accepts only a non-empty string `claims.sub`, and reads email only from the verified claims. It never trusts an unverified cookie session user.

Public middleware decisions return before a Supabase client or claim request is created. Protected middleware decisions retain the existing profile fields, account policy, session expiry, API response, and activity-touch behavior.

## Compatibility boundary

- No public or cross-user cache is added.
- No database schema, policy, function, or index changes.
- No new runtime dependency.
- `ScheduleWorkspaceInitialData` remains compatible with the existing client component.
- Dashboard calendar navigation remains behaviorally unchanged.
