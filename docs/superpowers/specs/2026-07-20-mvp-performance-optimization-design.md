# MVP Performance Optimization Design

## Goal

Improve the perceived and measured speed of the authenticated scheduling experience without increasing paid infrastructure, adding a cache service, or redesigning the product. The work reduces redundant server round trips, limits each screen to the data it actually uses, and keeps existing authorization and recovery behavior intact.

## Approved Scope

The selected scope is the balanced application-level approach:

1. Stop rereading the complete workspace after mutations that already update local state.
2. Load page-specific Supabase data instead of using one full-workspace query for every page.
3. Replace repeated remote Auth user lookups with verified JWT claims where the installed client and signing-key mode permit it.
4. Keep public routes out of authenticated middleware work.
5. Measure the same production flows before and after the change.

The user approved this direction after reviewing the project-specific performance analysis on 2026-07-20.

## Current Evidence

- A protected workspace page can issue approximately twelve Supabase requests across middleware, profile loading, and workspace loading when the user has rooms and schedules.
- Those requests form approximately seven sequential network stages: middleware identity, middleware profile, page identity, page profile/roles, room discovery, workspace rows, and schedule joins.
- `getScheduleWorkspaceData` selects all columns and all schedules before it knows which page is being rendered.
- Dashboard, today, preliminary, rooms, room detail, and mypage all call the same loader.
- `ScheduleWorkspace.tsx` calls `router.refresh()` in sixteen mutation paths even though those paths already update client state.
- `schedule-actions.ts` broadly revalidates five dynamic routes after most mutations.
- The verified production build reports 207 kB First Load JS for each workspace route and a 91.7 kB middleware bundle.
- OCR is already lazy-loaded and the schedule lookup already has a `(room_id, start_at)` index, so neither is an initial optimization target.

## Approaches Considered

### 1. Application-level round-trip reduction — selected

Make query scope explicit, preserve optimistic local updates, and use locally verifiable claims for ordinary page protection. This directly addresses the observed request graph, needs no new service, and can be delivered in independently testable slices.

### 2. Shared cache or larger hosting resources — rejected

Redis, read replicas, and higher service tiers add operating cost and cross-user cache risk. The current bottleneck is duplicated personalized work rather than demonstrated resource saturation.

### 3. One database bootstrap RPC — deferred

A single RPC could reduce round trips further, but it would couple unrelated screens to one response contract and require a migration. It is justified only if the scoped loaders remain slow after measurement.

## Architecture

### Mutation refresh policy

Successful mutations return the changed identifier or value and the client applies that result to existing local state. Routine changes such as checked state, task completion, schedule status, task editing, profile editing, and preference editing do not call `router.refresh()` afterward.

Navigation-changing operations continue to navigate to the destination route. The destination is dynamically rendered and reads current data. A full refresh remains available only for a mutation whose complete resulting state cannot be represented by its response; no such routine mutation is planned in this scope.

The broad `revalidateApp()` helper is removed. All current workspace pages are request-time rendered and the Supabase reads are user-specific, so path invalidation provides no useful cache freshness for these actions.

### Page-scoped data loading

`getScheduleWorkspaceData` receives a required page scope and an optional room identifier. It returns the existing `ScheduleWorkspaceInitialData` shape so UI behavior can be changed incrementally without introducing a new state library.

| Page | Rooms/members | Schedules | Tasks | Preferences |
|---|---|---|---|---|
| Dashboard | All accessible rooms | All accessible schedules required by the existing navigable calendar | User tasks | No |
| Today | All accessible rooms | Only schedules overlapping the current Korean calendar day | No | No |
| Preliminary | All accessible rooms | No | User tasks | No |
| Rooms | All accessible rooms | Summary columns only; no participants or user-state joins | No | No |
| Room detail | Requested room only | Requested room only | No | No |
| Mypage | All accessible rooms | No | No | Current user preference |

Every query names the columns consumed by its mapper. Wildcard selects are removed from the workspace loader and current-profile loader.

The dashboard intentionally keeps its current complete calendar behavior in this feature. Incremental calendar-range fetching is deferred because it requires a loading contract for calendar navigation and is not necessary for the current MVP data scale.

### Authentication request reduction

Public routes return from middleware before a Supabase client or identity check is created.

Protected routes continue to verify identity and account state. The installed `@supabase/supabase-js` version exposes `auth.getClaims()`. Middleware and `getCurrentProfile` use verified claims for `sub` and `email` instead of fetching the Auth user record on every request. With an asymmetric signing key, verification uses WebCrypto and a cached JWKS; with a symmetric key, the client safely falls back to an Auth server check.

The middleware profile lookup remains in place for session-age and account-state enforcement. The page profile and role lookup remains RLS-protected. Consolidating those two profile reads is deferred because it would change the security responsibility boundary across pages and API routes.

### Client bundle boundary

The 207 kB workspace bundle is recorded as a baseline, not an automatic failure. Splitting the 2,630-line workspace is a separate follow-up only if the round-trip and query-scope work does not meet the success criteria. This avoids mixing a broad UI refactor into the highest-value server changes.

## Data Flow

### Page request

1. Middleware immediately allows a public route or verifies protected-route claims.
2. Middleware reads the minimal account-state fields required by the existing policy.
3. The page loader verifies claims and reads the current profile and active service roles in parallel.
4. The page passes its scope and optional room identifier to the workspace loader.
5. The workspace loader executes only the tables and joins required by that scope.
6. The existing client component receives the same initial-data shape and renders without a compatibility adapter.

### Mutation

1. The client enters a pending or optimistic state.
2. The Server Action performs the existing RLS-protected mutation.
3. On success, the client applies the returned value and keeps the current screen state.
4. On failure, optimistic state is restored and the existing actionable message is shown.
5. No workspace-wide refresh or path-wide revalidation occurs.

## Security and Error Handling

- RLS remains the final database authorization boundary.
- Claims must be cryptographically verified; unverified session objects are not used for authorization.
- Middleware account-state, session-age, and activity-touch behavior remains functionally equivalent.
- Missing or invalid claims produce the existing login or API authentication response.
- Scoped data-query failures preserve the current user-facing fallback in this feature; changing the workspace error experience remains separate from the performance work.
- Optimistic mutation failure restores the previous client state.
- No personalized response is placed in a public or cross-user cache.

## Testing Strategy

Behavioral changes follow red-green-refactor:

- Add source-contract and focused unit tests proving routine mutations no longer request a full refresh.
- Add query-recorder tests proving each page touches only its allowed tables, schedule filters, and explicit columns.
- Add middleware-access tests for public early return, authenticated claims, account-state redirects, and expired sessions.
- Add current-profile tests for verified claim identity and role mapping.
- Keep existing authorization, schedule-day, action, and UI contract tests passing.
- Run full unit tests, security tests, type checking, linting, and production build before handoff.

## Measurement and Acceptance

Record ten comparable runs before and after implementation from the Korean production deployment or an equivalent authenticated preview:

- Dashboard useful-content time and page-data response size.
- Today, preliminary, and mypage useful-content time and page-data response size.
- Checked-state and task-completion time from user action to stable UI.
- Supabase request count for initial page load and routine mutation.
- First Load JS and middleware bundle values from `npm run build`.

The feature succeeds when routine mutations do not trigger a full workspace request, scoped pages no longer read unrelated tables, security behavior is unchanged, and the median measured user-facing times improve according to the Spec Kit success criteria.

## Non-Goals

- New paid infrastructure, Redis, read replicas, or larger service plans.
- Cross-user response caching or ISR for authenticated workspace data.
- A new client state-management or fetching library.
- A database migration, new index, or bootstrap RPC.
- Calendar range pagination.
- A complete `ScheduleWorkspace.tsx` decomposition.
- Changes to product copy, visual design, or scheduling business rules.

## Rollout

Implement and review in three independent slices: mutation refresh removal, page-scoped loading, then claim-based authentication. Capture measurements after each slice so a regression can be attributed and reverted without discarding the other improvements.
