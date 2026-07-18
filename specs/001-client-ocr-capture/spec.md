# Feature Specification: Browser-local schedule screenshot OCR

**Feature Branch**: `001-client-ocr-capture`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "When adding a schedule, recognize text from a
message screenshot in the browser, place it in the existing message input, and
automatically fill schedule fields. Support Chrome, Safari, and Samsung
Internet. Keep OCR on the frontend and report browser test limits honestly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture a message screenshot (Priority: P1)

When adding a schedule, a user selects a message screenshot and receives the
recognized message text in the existing text area. The user can review the text
before saving the schedule.

**Why this priority**: It removes manual transcription while preserving user
control over potentially imperfect recognition.

**Independent Test**: Select a clear message screenshot containing Korean text
and confirm the extracted text appears in the message input without uploading
the image.

**Acceptance Scenarios**:

1. **Given** a user is on the schedule-add form, **When** they select a
   supported message image, **Then** the form shows processing feedback and
   places recognized text in the message input when processing finishes.
2. **Given** recognized text is displayed, **When** the user edits it, **Then**
   their edits remain available for manual automatic input.
3. **Given** no text can be recognized, **When** processing completes, **Then**
   the form explains the result and preserves any existing form values.

---

### User Story 2 - Automatically fill schedule details (Priority: P2)

After text is recognized from a screenshot, a user receives automatic values
for eligible schedule fields and can correct them before saving.

**Why this priority**: The OCR text is useful only when it speeds up schedule
entry without hiding or locking the extracted values.

**Independent Test**: Use recognized or pasted text with a date, time range,
address, Korean mobile number, and cost; confirm each eligible field is filled
and the schedule name remains unchanged.

**Acceptance Scenarios**:

1. **Given** recognized text contains eligible values, **When** automatic input
   runs, **Then** it fills date, start time, end time, address, customer phone,
   estimated cost, and additional information where values are found.
2. **Given** recognized text is missing a value, **When** automatic input runs,
   **Then** it does not erase the existing value in that field.
3. **Given** recognized text contains a possible schedule title, **When**
   automatic input runs, **Then** it does not change the schedule name.

---

### User Story 3 - Recover on supported browsers (Priority: P3)

A user on Chrome, Safari, or Samsung Internet can understand whether recognition
is in progress, unavailable, or unsuccessful and can still enter message text
manually.

**Why this priority**: Browser or device limitations must not block schedule
creation.

**Independent Test**: Simulate an unavailable recognition capability and
confirm the user sees a clear explanation and can still paste text and use
automatic input.

**Acceptance Scenarios**:

1. **Given** recognition cannot be started on a device, **When** the user
   selects an image, **Then** the form explains that manual text input remains
   available.
2. **Given** recognition is taking place, **When** the user views the form,
   **Then** the processing state is clear and duplicate processing cannot be
   triggered accidentally.

### Edge Cases

- The selected file is not an image, is empty, or cannot be decoded.
- A very large image must not make the schedule form unusable on a phone.
- OCR returns empty text, partial text, or a malformed phone number.
- A user already entered a value before recognition; missing extracted values
  must not overwrite it.
- Safari, Chrome, or Samsung Internet cannot provide a required local runtime
  capability.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user select a message screenshot while
  adding a schedule.
- **FR-002**: The system MUST recognize supported screenshot text locally on
  the user's device and MUST NOT upload the image or recognized text for OCR.
- **FR-003**: The system MUST show the recognized text in the existing message
  text input for user review and editing.
- **FR-004**: The system MUST apply recognized or manually pasted text to the
  eligible date, start time, end time, address, customer phone, estimated cost,
  and additional-information fields.
- **FR-005**: The system MUST NOT automatically set or overwrite the schedule
  name from recognized text.
- **FR-006**: The system MUST preserve a field's existing value when the input
  text does not contain a value for that field.
- **FR-007**: The system MUST provide progress, success, empty-result, and
  actionable failure feedback without blocking manual text entry.
- **FR-008**: The system MUST support the documented current Chrome, Safari,
  and Samsung Internet browser targets through one consistent client-side OCR
  experience or present a clear manual-input fallback.
- **FR-009**: The system MUST limit image-processing work so a large selected
  image does not unnecessarily exhaust common mobile-device resources.
- **FR-010**: The validation report MUST identify which browser targets were
  directly exercised and which were assessed without direct execution.

### Key Entities

- **OCR capture**: A temporary, local attempt to convert one selected image
  into message text, including its processing state and user-facing result.
- **Parsed schedule details**: The eligible field values derived from reviewed
  message text before the user saves the schedule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a clear supported message screenshot, a user can reach
  reviewed text and filled eligible details in one image selection and without
  leaving the schedule-add form.
- **SC-002**: When the input includes a recognizable date, time range, address,
  Korean mobile number, and cost, all six matching detail fields plus additional
  information are populated while the schedule name remains unchanged.
- **SC-003**: In an unavailable or failed-recognition case, a user can still
  paste text and start automatic input without reopening the form.
- **SC-004**: Browser validation explicitly records direct execution evidence
  for each available target and names any unavailable test target.

## Assumptions

- Users select ordinary message screenshots containing readable Korean or
  English text; handwriting and severely blurred content are outside the
  accuracy commitment.
- The existing text parser remains the authority for eligible schedule fields.
- Schedule name entry remains manual by product decision.
- Current Chrome, Safari, and Samsung Internet provide a modern mobile browser
  runtime; older releases can use the manual-text fallback.
