# Data Model: MVP scheduling performance optimization

This feature adds no persistent database entity. It introduces request-time contracts over existing domain records.

## Workspace Data Scope

Defines which existing data categories may be requested for one rendered screen.

| Field | Allowed values | Validation |
|---|---|---|
| `page` | `dashboard`, `todayTasks`, `preliminaryTasks`, `rooms`, `room`, `mypage` | required |
| `roomId` | existing accessible room identifier | required only for `room`; absent otherwise |
| `referenceDate` | request-time instant | optional test seam; defaults to current time |

### Scope matrix

| Scope | Rooms | Members | Schedules | Participants | User states | Tasks | Preference |
|---|---:|---:|---:|---:|---:|---:|---:|
| `dashboard` | all accessible | yes | all accessible | yes | yes | yes | no |
| `todayTasks` | all accessible | yes | Korean-day overlap | yes | yes | no | no |
| `preliminaryTasks` | all accessible | yes | no | no | no | yes | no |
| `rooms` | all accessible | yes | summary fields | no | no | no | no |
| `room` | requested room | yes | requested room | yes | yes | no | no |
| `mypage` | all accessible | yes | no | no | no | no | yes |

The loader continues to return arrays for rooms, schedules, and tasks plus an optional preference. An excluded category returns an empty array or absent preference and must not issue a database request.

## Routine Mutation Policy

Describes whether a successful action needs a full route refresh.

| Category | Examples | Success behavior | Failure behavior |
|---|---|---|---|
| Local-state mutation | checked state, task completion, task edit, schedule status, profile, preference | apply returned value; no refresh | restore prior value or keep input; show message |
| Structural local-state mutation | room create/delete, member role/removal, ownership transfer, schedule create/delete | update represented collections or navigate; no extra source refresh | keep prior collections; show message |
| Navigation mutation | invite redeem, room deletion destination | navigate once to dynamically rendered destination | remain on source and show message |

## Verified Identity

| Field | Source | Validation |
|---|---|---|
| `userId` | verified `sub` claim | non-empty string required |
| `email` | verified `email` claim | string; empty display fallback permitted |

An invalid or missing verified subject produces no identity. The caller applies its existing page redirect or API authentication response.

## Korean Day Bounds

| Field | Meaning | Validation |
|---|---|---|
| `startAt` | inclusive start of the calendar day at `+09:00` | valid ISO instant |
| `endAt` | exclusive start of the following calendar day at `+09:00` | exactly one Korean calendar day after `startAt` |

A schedule overlaps today when `schedule.start_at < endAt` and `schedule.end_at > startAt`.

## Performance Measurement Sample

This record is documentation-only and is not persisted by the application.

| Field | Meaning |
|---|---|
| flow | one core page load or routine mutation |
| environment | production or authenticated preview identifier without secrets |
| run | integer from 1 through 10 |
| usefulContentMs | navigation/action start to stable useful UI |
| pageDataBytes | transferred page-data bytes |
| supabaseRequests | counted Supabase requests in the measured flow |
| fullWorkspaceRefresh | whether a routine mutation triggered a complete workspace request |

Median values are compared against the recorded 2026-07-20 baseline.
