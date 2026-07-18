# Implementation Plan: Commercial Readiness Foundation

**Branch**: `codex/commercial-readiness` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-commercial-readiness/spec.md`

## Summary

Extend the existing shared scheduling application into a public multi-user service by introducing explicit account states, three email-optional custom social providers, legal-guardian consent gating, room and service capability checks, hashed limited invitations, private support inquiries, scoped administration, encrypted private profiles, append-only audit events, transactional request controls, and documented operational recovery. Domain decisions remain pure TypeScript; Supabase access stays in server/data boundaries; all exposed tables receive RLS and focused tests precede behavioral implementation.

## Technical Context

**Language/Version**: TypeScript 5.7.2 on Node.js 22, SQL/PLpgSQL on PostgreSQL

**Primary Dependencies**: Next.js 15.0.4 App Router, React 19.0.0, Supabase JS 2.46.1, Supabase SSR 0.5.2, Zod 3.23.8, React Hook Form 7.53.2, Tailwind CSS 3.4.16, Node `crypto`

**Storage**: Supabase PostgreSQL with RLS; Supabase Auth for identities and password verification; server-only versioned encryption keys supplied by deployment secrets

**Testing**: Node built-in test runner with TypeScript stripping and experimental coverage; SQL/RLS validation scripts; Next.js typecheck, ESLint, production build; direct browser smoke and accessibility review

**Target Platform**: Vercel-compatible Next.js server runtime, modern mobile and desktop browsers, Supabase hosted Auth and PostgreSQL

**Project Type**: Full-stack web application

**Performance Goals**: General user actions at p95 <= 500 ms excluding intentional throttling; atomic request-control and invitation decisions across instances; 1,000 concurrent final-use invitation trials without over-redemption

**Constraints**: No provider token storage; no automatic email-based identity linking; no public schedule content; 80% line and function coverage for changed code; WCAG 2.2 AA; RPO 24 hours; RTO four hours; external providers remain disabled without credentials

**Scale/Scope**: Six user stories, 62 functional requirements, 12 success criteria, four room roles, four service roles, three social providers, public-user and PC-admin interfaces

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Principle | Pre-design result | Post-design result | Evidence |
|---|---|---|---|
| User Data Stays Deliberate | PASS | PASS | Private fields are encrypted server-side, provider tokens are not stored, and logs are redacted. |
| Mobile-First Compatibility | PASS | PASS | User flows begin at 360 px; browser verification reports direct and reasoned targets separately. |
| Test Before Behavioral Changes | PASS | PASS | Every behavioral task begins with a failing focused test and ends with full verification. |
| Explicit Recovery Paths | PASS | PASS | Provider, consent, inquiry, deletion, and background flows preserve state and provide recovery actions. |
| Focused, Reviewable Changes | PASS | PASS | Work is staged by user story in an isolated worktree and excludes the existing `.gitignore` change. |
| Privacy & Compatibility Constraints | PASS | PASS | No image handling changes; runtime browser behavior and external-provider disabled states are explicit. |
| Development Workflow | PASS | PASS | Spec, design, tasks, quickstart, migration approval gate, and validation results are recorded. |

No constitution violation requires a complexity exception.

## Project Structure

### Documentation (this feature)

```text
specs/002-commercial-readiness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── http-api.md
└── tasks.md

docs/superpowers/
├── specs/2026-07-18-commercial-readiness-foundation-design.md
└── plans/2026-07-18-commercial-readiness-foundation.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── actions/
│   ├── admin/
│   ├── api/
│   │   ├── auth/
│   │   ├── invites/
│   │   ├── inquiries/
│   │   ├── privacy/
│   │   └── admin/
│   ├── auth/
│   ├── join/
│   └── support/
├── components/
│   ├── app/
│   ├── auth/
│   ├── admin/
│   └── support/
├── data/
│   ├── repositories/
│   ├── database.types.ts
│   └── schedule-supabase.ts
├── domain/
│   ├── auth/
│   ├── authorization/
│   ├── invites/
│   ├── privacy/
│   ├── rate-limit/
│   └── support/
├── lib/
│   ├── audit/
│   ├── auth/
│   ├── privacy/
│   ├── rate-limit/
│   └── supabase/
└── middleware.ts

supabase/
├── migrations/
└── tests/

docs/operations/
├── auth-providers.md
├── incident-response.md
├── privacy-retention.md
└── backup-restore.md
```

**Structure Decision**: Keep the existing single Next.js project and add responsibility-focused domain, server infrastructure, route, component, SQL, and operations files. Existing large workspace components remain untouched unless a new navigation entry is required. Database access does not move into React components or domain modules.

## Delivery Phases

### Phase 0 - Research and compatibility decisions

Resolve identity linking, social provider behavior, RLS boundaries, encryption envelope, shared request control, session policy, and external activation constraints in [research.md](./research.md).

### Phase 1 - Data and interface design

Define entities and state transitions in [data-model.md](./data-model.md), HTTP boundaries in [contracts/http-api.md](./contracts/http-api.md), and end-to-end validation in [quickstart.md](./quickstart.md).

### Phase 2 - Shared foundation

Add pure domain policies, server configuration validation, encryption envelope, audit vocabulary, authorization resolver, and the approved database migration. Apply RLS and transactional functions before exposing feature routes.

### Phase 3 - Secure accounts

Move password sign-in behind a controlled server endpoint, add registration, callback, profile completion, recovery, recent reauthentication, social linking, guardian adapter, and account-state middleware.

### Phase 4 - Controlled room invitations

Replace reusable plaintext codes with hashed opaque tokens, safe previews, revocation, replacement, atomic redemption, viewer role, and invitation history.

### Phase 5 - Support and scoped administration

Add inquiry history and notification flows, service-role administration, account and room sanctions, audit review, and PC-first management pages.

### Phase 6 - Request control and operations

Add trusted IP resolution, general and sensitive policies, shared counters and blocks, deletion and key-rotation jobs, monitoring hooks, operations runbooks, and full quality verification.

## Complexity Tracking

No constitution exception is requested. The number of modules reflects independent security and privacy responsibilities that require separate interfaces and tests.

