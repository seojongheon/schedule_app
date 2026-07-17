<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles: none (initial adoption)
- Added principles: Test-First Delivery; Minimal Scoped Change; Responsive UI Containment;
  Architecture and Type Safety; Evidence Before Completion
- Added sections: Project Constraints; Development Workflow and Quality Gates
- Removed sections: all unfilled template placeholders
- Templates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md (already requires user scenarios and testing)
  - ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: none
-->
# Shared Schedule Constitution

## Core Principles

### I. Test-First Delivery (NON-NEGOTIABLE)

Every feature, behavior change, and bug fix MUST follow red-green-refactor. A focused
automated test MUST be written and observed failing for the intended reason before
production code changes. The smallest implementation that makes the test pass comes
next; cleanup occurs only while tests remain green. User-facing layout work MUST also
include browser-level validation at the viewport sizes named in the feature spec.

### II. Minimal Scoped Change

Each change MUST be limited to the approved specification and MUST preserve unrelated
behavior. Existing user modifications and untracked files MUST not be overwritten,
reformatted, staged, or committed. Refactoring is permitted only when it directly
supports the requested behavior or makes its test boundary clear. New dependencies,
database migrations, and external state changes require explicit justification; database
migrations additionally require user approval before creation or modification.

### III. Responsive UI Containment

Mobile-first interface changes MUST define explicit layout boundaries for narrow screens.
Text-bearing flex and grid descendants MUST be able to shrink, must not expand their
assigned track, and must use an intentional wrapping or truncation policy. UI acceptance
checks MUST cover the specified minimum, typical, and maximum mobile widths and MUST
include long Korean text, long Latin text, and unbroken strings where text overflow is in
scope.

### IV. Architecture and Type Safety

Domain code MUST remain independent of React, Next.js, Supabase clients, and UI
libraries. External data access MUST remain in the data or server boundary appropriate to
the existing codebase. TypeScript changes MUST pass the project's dedicated typecheck,
and Supabase or database changes MUST preserve server/browser isolation and row-level
security requirements. Presentation-only rules SHOULD stay close to the presentation
component unless they form reusable business behavior.

### V. Evidence Before Completion

No task, feature, or fix may be reported complete without fresh verification evidence.
The required commands MUST be run after the final change, their exit codes and relevant
output MUST be inspected, and browser acceptance scenarios MUST be checked when visual
behavior is part of the requirement. Spec, plan, and task coverage MUST be reviewed
before completion; any unverified gap MUST be reported explicitly.

## Project Constraints

- The application remains a Next.js App Router, React, TypeScript, Tailwind CSS, and
  Supabase project unless a separate approved specification changes the stack.
- Existing package versions and runtime conventions MUST be reused for targeted fixes;
  new runtime or test dependencies require a documented need in the implementation plan.
- Searches and reads MUST exclude generated output, dependencies, secrets, lockfiles,
  and binary assets unless one is directly relevant to the diagnosed problem.
- Environment files and credentials MUST never be printed, copied into artifacts, or
  committed.
- Feature artifacts live under `specs/`; detailed agent guidance remains under
  `docs/agent/`; Superpowers design and execution documents live under
  `docs/superpowers/`.

## Development Workflow and Quality Gates

1. Create or update `spec.md` with testable user stories, requirements, edge cases, and
   measurable outcomes.
2. Produce `plan.md` and supporting research/validation artifacts, then check every
   design choice against this constitution.
3. Generate dependency-ordered `tasks.md`; behavior-changing tasks MUST put a failing
   test before production code.
4. Run non-destructive cross-artifact analysis before implementation and resolve every
   CRITICAL or HIGH finding.
5. Execute tasks in order, marking a task complete only after its listed verification
   passes.
6. Run convergence after implementation and complete any appended remediation tasks.
7. Before handoff, run unit tests, typecheck, lint, production build, and all feature
   browser checks required by `quickstart.md`.

Reviews MUST verify scope preservation, red-green evidence, responsive containment for
UI changes, architecture boundaries, and fresh completion evidence. A failed required
gate blocks completion until fixed or explicitly accepted by the user with the remaining
risk documented.

## Governance

This constitution supersedes conflicting workflow guidance for work governed by Spec
Kit artifacts. Amendments require a documented rationale, updates to dependent templates,
and semantic versioning: MAJOR for incompatible principle removal or redefinition, MINOR
for new or materially expanded principles, and PATCH for non-semantic clarification.
Every feature plan and final review MUST check compliance. Exceptions require explicit
user approval and MUST be recorded in the plan's Complexity Tracking section.

**Version**: 1.0.0 | **Ratified**: 2026-07-18 | **Last Amended**: 2026-07-18
