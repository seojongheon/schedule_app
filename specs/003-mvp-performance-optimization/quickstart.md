# Quickstart: MVP scheduling performance optimization validation

## Prerequisites

- Existing dependencies installed with `npm install`.
- A valid non-production test account with at least two rooms, schedules in both rooms, one schedule crossing Korean midnight, preliminary tasks, and a saved preference.
- An authenticated Korea production deployment or equivalent preview connected to the Korea Supabase project.
- Browser developer tools with Network recording enabled and cache disabled for measurement runs.

Do not record access tokens, cookies, emails, phone numbers, addresses, room identifiers, or schedule content in the measurement notes.

## Baseline record

Before implementation, record ten runs for each flow:

1. Open `/dashboard` from `/login` after authentication.
2. Navigate to `/dashboard/today`.
3. Navigate to `/dashboard/preliminary`.
4. Navigate to `/rooms` and one `/rooms/[roomId]` page.
5. Navigate to `/mypage`.
6. Toggle one schedule checked state.
7. Toggle one preliminary task completed state.

For each run, record useful-content time, page-data bytes, Supabase request count, and whether a mutation produced a complete workspace request. Use median values for comparison.

The planning build baseline recorded on 2026-07-20 is:

- Workspace First Load JS: 207 kB per workspace route.
- Middleware bundle: 91.7 kB.
- Production build: exit code 0.

## Focused automated checks

Run focused tests during their implementing task:

```bash
node --no-warnings --experimental-strip-types --test src/components/app/workspace-refresh-contract.test.mjs
node --no-warnings --experimental-strip-types --test src/data/schedule-supabase.test.mjs
node --no-warnings --experimental-strip-types --test src/lib/auth/verified-identity.test.mjs src/lib/auth/middleware-access.test.mjs
node --no-warnings --experimental-strip-types --test src/lib/schedule-day.test.mjs
```

Expected: all focused tests pass, and the scope test names each excluded data category.

## Full automated checks

```bash
npm run test:unit
npm run test:security
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0. The build must not report a workspace route above the 207 kB First Load JS baseline.

## Browser verification

Repeat the seven baseline flows ten times under the same browser, test data, deployment, and network settings.

Verify behavior:

- Checked-state and task-completion updates settle without a complete workspace request.
- A forced mutation failure restores the previous visible value and shows an actionable message.
- Today includes schedules overlapping Korean midnight and excludes other dates.
- Preliminary and mypage make no schedule request.
- Room detail requests schedules only for the selected room.
- Public pages make no protected-profile request.
- Signed-out, restricted, and expired-session cases preserve their existing redirect or denial.
- Dashboard calendar navigation still shows the same complete schedule set as before.

## Acceptance calculation

- Routine mutation median stable-state time improves by at least 30%.
- Today, preliminary, and mypage page-data bytes each improve by at least 30%.
- At least four core screens improve median useful-content time by at least 20%.
- No core screen regresses by more than 5%.
- At least nine of ten successful checked/task trials produce no complete workspace request.
- Security outcomes remain identical across the documented denial scenarios.

If a target misses its threshold, retain the correctness-preserving changes, identify the remaining request stage from the trace, and do not add an index, RPC, cache, or larger plan without separate measured evidence and approval.
