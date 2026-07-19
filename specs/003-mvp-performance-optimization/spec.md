# Feature Specification: MVP scheduling performance optimization

**Feature Branch**: `003-mvp-performance-optimization`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "Improve the current scheduling project's speed at MVP scale after moving the deployment and database to Korea, without using more resources or overengineering."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete routine updates without a full reload (Priority: P1)

An authenticated user checks an assigned schedule, completes a preliminary task, edits a schedule status, or saves a personal setting and sees the successful change remain on screen without waiting for the complete workspace to reload.

**Why this priority**: These are frequent interactions, and the current full reread repeats the largest amount of avoidable work after every successful change.

**Independent Test**: Complete each covered routine update and confirm the changed state becomes stable without a full-page loading transition or a second complete workspace request.

**Acceptance Scenarios**:

1. **Given** an authenticated user is viewing a workspace screen, **When** a routine update succeeds, **Then** the changed value remains visible without reloading unrelated rooms, schedules, tasks, or settings.
2. **Given** a routine update is applied optimistically, **When** the server rejects the update, **Then** the previous value is restored and the user receives an actionable failure message.
3. **Given** an operation navigates to a different screen, **When** the operation succeeds, **Then** the destination screen loads current data without an additional refresh of the source screen.

---

### User Story 2 - Open each screen with only relevant data (Priority: P2)

An authenticated user opens dashboard, today, preliminary tasks, rooms, room detail, or mypage and receives the information required by that screen without waiting for unrelated schedule or task history.

**Why this priority**: The current shared loader grows with all workspace data even when the selected screen uses only a small subset.

**Independent Test**: Open each core screen with representative rooms, schedules, tasks, and preferences and confirm that its visible behavior is unchanged while unrelated data categories are not requested.

**Acceptance Scenarios**:

1. **Given** a user opens today, **When** the screen loads, **Then** only schedules overlapping the current Korean calendar day are included.
2. **Given** a user opens preliminary tasks, **When** the screen loads, **Then** task and room information is available without loading schedules or schedule participation state.
3. **Given** a user opens mypage, **When** the screen loads, **Then** profile, room membership, and preference information is available without loading schedules or preliminary tasks.
4. **Given** a user opens one room, **When** the room loads, **Then** only that room's schedules and participant data are included.
5. **Given** a user opens the room list, **When** the list loads, **Then** room summaries remain visible without loading schedule-detail-only fields or user schedule state.
6. **Given** a user opens the dashboard, **When** the screen loads, **Then** its existing calendar navigation and visible summaries continue to work.

---

### User Story 3 - Navigate securely with less repeated identity work (Priority: P3)

An authenticated user moves among protected screens without repeated remote identity lookups that do not change the authorization decision, while blocked, expired, and signed-out accounts receive the same protection as before.

**Why this priority**: Identity checks are on the critical path of every protected request, but performance changes must not weaken account or session enforcement.

**Independent Test**: Exercise public, valid authenticated, signed-out, restricted-account, and expired-session scenarios and compare decisions with the current access policy while recording identity-service requests.

**Acceptance Scenarios**:

1. **Given** a public route, **When** it is requested, **Then** it is served without protected-route identity or profile work.
2. **Given** a valid authenticated session, **When** a protected route is requested, **Then** the identity is cryptographically verified and the existing account-state policy is enforced.
3. **Given** a signed-out, invalid, restricted, or expired session, **When** a protected route is requested, **Then** the existing redirect or API authentication response is preserved.
4. **Given** a valid user opens a workspace page, **When** profile and service-role information is loaded, **Then** no additional fresh user-record lookup is required solely to obtain identity and email.

### Edge Cases

- A user has no rooms, no schedules, no preliminary tasks, or no saved preference.
- A schedule spans midnight and overlaps the current Korean calendar day.
- A room identifier is missing, malformed, inaccessible under record-level access rules, or no longer exists.
- A routine mutation succeeds but the returned payload is incomplete.
- A routine mutation fails after an optimistic state change.
- The authentication project uses a signing mode that cannot verify claims locally and safely falls back to remote verification.
- A session expires during navigation or requires token refresh.
- Account activity touch is due while a protected request is being processed.
- A user navigates from a scoped screen to a different screen that needs data not previously loaded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST keep successful routine updates visible without rereading unrelated workspace data.
- **FR-002**: The system MUST restore the previous visible value and show an actionable message when an optimistic routine update fails.
- **FR-003**: The system MUST define and enforce a distinct data scope for dashboard, today, preliminary tasks, rooms, room detail, and mypage.
- **FR-004**: The today scope MUST include schedules that overlap the current calendar day in Korea, including schedules that cross midnight.
- **FR-005**: The preliminary-task scope MUST exclude schedules, schedule participants, and schedule user state.
- **FR-006**: The mypage scope MUST exclude schedules and preliminary tasks while retaining profile, room membership, and preference behavior.
- **FR-007**: The room-detail scope MUST exclude other rooms' schedule details.
- **FR-008**: The room-list scope MUST exclude schedule-detail-only and per-user schedule-state data while preserving displayed room summaries.
- **FR-009**: Data responses MUST include only fields consumed by their visible behavior or authorization policy.
- **FR-010**: Public routes MUST bypass protected-route identity and profile work.
- **FR-011**: Protected routes MUST cryptographically verify identity before trusting claim values.
- **FR-012**: Account state, session age, activity tracking, service-role detection, record-level access, and unauthorized response behavior MUST remain equivalent to the existing policy.
- **FR-013**: The system MUST safely fall back to remote identity verification when local claim verification is unavailable for the active signing mode.
- **FR-014**: The implementation MUST NOT introduce a paid infrastructure dependency, shared cache service, read replica, or new client data-management library.
- **FR-015**: The implementation MUST NOT place personalized workspace responses in a public or cross-user cache.
- **FR-016**: The implementation MUST capture comparable before-and-after measurements for core page loading, routine update completion, request count, and transferred page data.
- **FR-017**: Behavioral changes MUST be covered by focused automated tests written before implementation and by the project's full verification gates before handoff.

### Key Entities

- **Workspace data scope**: The allowed categories of room, schedule, participant, task, preference, and profile information for one core screen.
- **Routine update**: A successful or failed user action whose result can be represented directly in current screen state without reloading the full workspace.
- **Verified identity claims**: Cryptographically validated session identity values used to locate the current user's access-controlled records.
- **Performance measurement sample**: A comparable observation of one page load or routine update, including elapsed time, request count, and transferred page-data size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In ten comparable trials per action, at least nine successful checked-state and task-completion updates become stable without a complete workspace request or full-screen loading transition.
- **SC-002**: Under the same authenticated Korean deployment conditions, the median time from a routine update action to stable visible state improves by at least 30% from the recorded baseline.
- **SC-003**: Under the same test data and network conditions, today, preliminary tasks, and mypage each transfer at least 30% less page data than their recorded baselines.
- **SC-004**: Under the same test data and network conditions, the median time until useful content is visible improves by at least 20% on at least four of the six core workspace screens and does not regress by more than 5% on any core screen.
- **SC-005**: All documented signed-out, invalid-session, restricted-account, expired-session, and record-level access scenarios produce the same allow, redirect, or denial result as before the optimization.
- **SC-006**: Each core screen passes an automated scope check proving that no excluded data category is requested.
- **SC-007**: The production build completes without increasing any workspace route's initial application-code transfer above the recorded 207 kB baseline.
- **SC-008**: The completed change uses the existing hosting and database resources and adds no paid or always-on infrastructure component.

## Assumptions

- The application remains a personalized, dynamically rendered scheduling product rather than a publicly cacheable content site.
- The existing Korea deployment and Supabase region remain unchanged during before-and-after measurement.
- Existing record-level access policies remain the authority for workspace data access.
- The current dashboard's unrestricted client-side calendar navigation is preserved; calendar range pagination is a separate future feature.
- Current MVP data volume does not justify a new index or aggregated bootstrap operation without measured evidence.
- The existing authentication system supports cryptographic claim verification and safely performs remote verification when local verification is not possible.
- The 207 kB initial workspace application code and 91.7 kB request-guard code from the 2026-07-20 production build are the planning baselines.

## Out of Scope

- Service-plan upgrades, Redis, read replicas, or cross-user caching.
- Database migrations, new indexes, and an all-screen bootstrap operation.
- Calendar-range pagination or infinite loading.
- A complete decomposition of the shared workspace client component.
- Product redesign, new scheduling features, or copy changes.
