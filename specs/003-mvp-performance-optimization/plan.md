# Implementation Plan: MVP scheduling performance optimization

**Branch**: `main` (planning only; implementation requires an isolated worktree) | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-mvp-performance-optimization/spec.md`

## Summary

Reduce avoidable personalized-data round trips without adding infrastructure. The implementation removes redundant route refreshes after locally represented mutations, introduces page-scoped workspace reads with explicit columns, and uses cryptographically verified identity claims in place of repeated fresh Auth user-record requests while preserving middleware account enforcement and RLS.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 15.5.19

**Primary Dependencies**: Existing `@supabase/ssr` 0.5.2, resolved `@supabase/supabase-js` 2.110.0, date-fns 4, and the current Next.js App Router; no new dependency

**Storage**: Existing Supabase PostgreSQL, Auth, cookies, and RLS; no schema or migration change

**Testing**: Node built-in test runner with TypeScript stripping, focused source-contract/query-recorder tests, existing security tests, TypeScript check, ESLint, production build, and authenticated browser/network verification

**Target Platform**: Mobile-first authenticated web application deployed on Vercel in Korea with Supabase in Korea

**Project Type**: Next.js web application with Server Components, Client Components, Server Actions, middleware, and Supabase data access

**Performance Goals**: Eliminate full workspace requests after routine mutations; reduce page-data transfer by at least 30% for today, preliminary, and mypage; improve routine-mutation median stable-state time by at least 30%; improve useful-content median time by at least 20% on four core screens without a regression above 5%

**Constraints**: Preserve dashboard calendar navigation, authorization decisions, activity touch, RLS, and failure rollback; no paid infrastructure, shared cache, read replica, new state library, database migration, broad UI rewrite, or cross-user cache

**Scale/Scope**: Six authenticated workspace routes and their existing routine mutations at current MVP data volume

## Constitution Check

- **I. User Data Stays Deliberate: PASS** — no new transfer destination or cache; explicit columns reduce transferred personal data.
- **II. Mobile-First Compatibility: PASS** — user-visible behavior remains unchanged and authenticated mobile browser verification is required.
- **III. Test Before Behavioral Changes: PASS** — each slice starts with focused failing tests; full typecheck, lint, build, and browser validation are mandatory.
- **IV. Explicit Recovery Paths: PASS** — optimistic updates retain rollback and actionable failure behavior; no form input is discarded.
- **V. Focused, Reviewable Changes: PASS** — three independent slices address measured request overhead; infrastructure, schema, calendar pagination, and workspace decomposition remain out of scope.
- **Development Workflow: PASS** — feature artifacts live in this directory, implementation is assigned to a clean worktree because the current checkout contains unrelated changes, and validation commands are explicit.

No constitution violation requires complexity justification.

## Project Structure

### Documentation

```text
specs/003-mvp-performance-optimization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/workspace-performance-contract.md
├── quickstart.md
├── tasks.md
├── validation.md
└── checklists/requirements.md

docs/superpowers/
├── specs/2026-07-20-mvp-performance-optimization-design.md
└── plans/2026-07-20-mvp-performance-optimization.md
```

### Source Code

```text
src/
├── app/
│   ├── actions/schedule-actions.ts                  # remove broad dynamic-route revalidation
│   ├── dashboard/page.tsx                           # pass dashboard scope
│   ├── dashboard/today/page.tsx                     # pass today scope
│   ├── dashboard/preliminary/page.tsx               # pass preliminary scope
│   ├── rooms/page.tsx                               # pass rooms scope
│   ├── rooms/[roomId]/page.tsx                      # pass room scope and identifier
│   └── mypage/page.tsx                              # pass mypage scope
├── components/app/
│   ├── ScheduleWorkspace.tsx                        # preserve local mutation state without refresh
│   └── workspace-refresh-contract.test.mjs          # enforce no routine full refresh
├── data/
│   ├── schedule-supabase.ts                         # page-scoped explicit-column loaders
│   └── schedule-supabase.test.mjs                   # query-recorder scope contracts
│   ├── schedule-workspace-query.ts                  # pure scope-to-query plan
│   └── schedule-workspace-query.test.mjs            # page scope matrix tests
├── lib/
│   ├── auth.ts                                      # load profile from verified claims
│   ├── auth/verified-identity.ts                     # claim-to-identity boundary
│   ├── auth/verified-identity.test.mjs               # identity validation tests
│   ├── schedule-day.ts                              # Korean-day bounds for scoped query
│   └── schedule-day.test.mjs                        # midnight-overlap bounds tests
└── middleware.ts                                    # public fast path and verified claims
```

**Structure Decision**: Retain the existing application layers and initial-data shape. Extract only the verified-identity boundary needed for isolated tests; keep query mapping in the established data file and postpone the large workspace component split.

## Phase 0: Research

See [research.md](./research.md). Official framework documentation confirms that `router.refresh()` makes a new server request and refetches data, Server Function `revalidatePath()` can immediately update the current UI and clear visited route state, and Supabase `getClaims()` avoids an Auth user-record request when asymmetric signing permits cached JWKS verification while falling back safely otherwise.

## Phase 1: Design

See [data-model.md](./data-model.md), [workspace-performance-contract.md](./contracts/workspace-performance-contract.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

All constitution gates remain satisfied. The contract explicitly forbids public or cross-user caching, preserves account-state and RLS enforcement, requires optimistic rollback, and adds no service, dependency, or database object.
