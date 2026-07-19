# Validation: MVP scheduling performance optimization

## Planning environment

- Date: 2026-07-20
- Checkout: primary planning checkout on `main` with unrelated user-owned changes
- Deployment: authenticated Korea production measurement not accessed during documentation
- Browser and version: NOT RUN — no authenticated performance measurement was authorized or required for planning
- Network profile: NOT RUN — must be fixed and recorded before implementation under T001
- Test-data shape: NOT INSPECTED — T001 records counts only and must not record personal values

## Code-path baseline

Static inspection of the current protected workspace path found approximately twelve Supabase requests for a user with rooms and schedules:

1. Middleware Auth user lookup.
2. Middleware profile lookup.
3. Page Auth user lookup.
4. Page profile lookup.
5. Page active service-role lookup.
6. Workspace room lookup.
7. Workspace member lookup.
8. Workspace schedule lookup.
9. Workspace task lookup.
10. Workspace preference lookup.
11. Schedule participant lookup.
12. Schedule user-state lookup.

The requests form approximately seven sequential network stages. Activity touch can add one request when due.

Current source evidence:

- `src/components/app/ScheduleWorkspace.tsx` contains 16 `router.refresh()` calls.
- `src/app/actions/schedule-actions.ts` contains one broad `revalidateApp()` helper and repeated calls after mutations.
- `src/data/schedule-supabase.ts` uses wildcard selects and one shared loader for all workspace pages.
- `src/middleware.ts` and `src/lib/auth.ts` each perform a fresh Auth user lookup on a protected page request.

## Authenticated baseline measurements

| Flow | Runs | Median useful content ms | Median page-data bytes | Median Supabase requests | Full workspace refresh |
|---|---:|---:|---:|---:|---|
| Dashboard load | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | n/a |
| Today load | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | n/a |
| Preliminary load | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | n/a |
| Rooms load | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | n/a |
| Room detail load | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | n/a |
| Mypage load | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | n/a |
| Checked-state update | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | code inspection: yes |
| Task-completion update | 0 | NOT RUN — T001 | NOT RUN — T001 | NOT RUN — T001 | code inspection: yes |

## Baseline security decisions

These outcomes are requirements derived from the existing access-policy code. Direct authenticated exercise remains T001 work.

| Scenario | Required current result | Direct observation |
|---|---|---|
| Public page | allow | NOT RUN — T001 |
| Signed-out protected page | redirect to login | NOT RUN — T001 |
| Signed-out protected API | 401 | NOT RUN — T001 |
| Restricted account product page | complete-profile or withdrawal redirect | NOT RUN — T001 |
| Expired session | login session-expired redirect or 401 | NOT RUN — T001 |

## Verified build baseline

- Command: `npm run build`
- Date: 2026-07-20
- Exit code: 0
- Next.js: 15.5.19
- Workspace First Load JS: 207 kB for dashboard, today, preliminary, rooms, room detail, and mypage
- Middleware bundle: 91.7 kB
- Shared First Load JS: 102 kB

## Implementation checkpoints

No implementation checkpoint has run. Production code remains unchanged by this planning work.

## Final comparison

Final values are intentionally absent until implementation and fresh verification. An implementer must not infer success from the plan or code inspection.
