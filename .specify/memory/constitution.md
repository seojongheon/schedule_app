<!--
Sync Impact Report
- Version change: template → 1.0.0
- Modified principles: replaced all template placeholders with project principles
- Added sections: Privacy & Compatibility Constraints; Development Workflow
- Removed sections: none
- Templates reviewed: ✅ .specify/templates/plan-template.md; ✅ .specify/templates/spec-template.md; ✅ .specify/templates/tasks-template.md; ✅ README.md
- Follow-up TODOs: none
-->

# Shared Schedule Constitution

## Core Principles

### I. User Data Stays Deliberate

Features handling customer messages, screenshots, phone numbers, or addresses
MUST keep data local unless a user-visible product requirement authorizes a
transfer. Secrets MUST remain server-only. Rationale: scheduling data commonly
contains personal information.

### II. Mobile-First Compatibility

User-facing flows MUST work on the documented current browser targets or offer
a clear, usable fallback. Verification reports MUST distinguish direct browser
execution from compatibility reasoning; untested targets MUST never be reported
as tested.

### III. Test Before Behavioral Changes

Behavioral changes MUST add or update focused automated tests before the
implementation that satisfies them. Type checking, linting, and production
build verification MUST pass before a feature is declared complete.

### IV. Explicit Recovery Paths

Async and device-dependent actions MUST show progress, success, and actionable
failure states without discarding user-entered data. Manual entry remains
available when automation cannot complete.

### V. Focused, Reviewable Changes

Each feature MUST keep its scope narrow, use existing project patterns where
practical, and document non-obvious choices. Unrelated refactors and untracked
generated changes MUST be excluded from feature commits.

## Privacy & Compatibility Constraints

- Image processing that is specified as client-side MUST not upload the image
  or recognized text to an external OCR service.
- Browser capability detection MUST happen at runtime when relying on optional
  web platform features.
- Mobile work MUST consider Chrome, Safari, and Samsung Internet when the
  feature is specified for those targets.

## Development Workflow

- Record feature requirements, design decisions, tasks, and validation steps in
  the active Spec Kit feature directory.
- Use a clean, isolated worktree for implementation when the primary checkout
  contains unrelated changes.
- Run focused tests during development and full typecheck, lint, build, and
  browser verification before handoff.

## Governance

This constitution governs feature specifications, plans, tasks, code changes,
and validation reports. Amendments require an explicit documented change,
semantic version update, and review of the Spec Kit templates. Every feature
review MUST verify compliance with the applicable principles.

**Version**: 1.0.0 | **Ratified**: 2026-07-18 | **Last Amended**: 2026-07-18
