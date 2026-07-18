# Implementation Plan: Browser-local schedule screenshot OCR

**Branch**: `001-client-ocr-capture` | **Date**: 2026-07-18 | **Spec**:
[spec.md](./spec.md)

## Summary

Replace the browser-specific image text detector with a lazily loaded,
browser-local OCR worker. The worker returns reviewed message text to the
existing text area, which continues to use the existing schedule-field parser.
No image or text is sent to an OCR service and schedule names remain manual.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 15

**Primary Dependencies**: `tesseract.js` for browser WebAssembly OCR; existing
date-fns, React, and Tailwind CSS

**Storage**: No new persisted data; selected images and OCR results remain in
the browser until the user saves the existing schedule form

**Testing**: Node's built-in test runner with TypeScript stripping for focused
unit tests; existing TypeScript, ESLint, production build, and Chrome browser
validation

**Target Platform**: Mobile-first web: current Chrome, Safari, and Samsung
Internet; desktop Chrome for direct automated browser exercise

**Project Type**: Next.js web application

**Performance Goals**: Start OCR only after image selection; resize images to a
maximum 2048px edge; reject files above 10MB; keep the form responsive while
the OCR worker runs

**Constraints**: Browser-local processing only; no image/text upload; Korean
and English recognition; manual entry recovery; no title inference; explicit
browser verification reporting

**Scale/Scope**: One schedule-add form and one selected image at a time

## Constitution Check

- I. User Data Stays Deliberate: PASS — no OCR network request, no public key.
- II. Mobile-First Compatibility: PASS — WebAssembly worker path plus manual
  fallback and explicit direct-test reporting.
- III. Test Before Behavioral Changes: PASS — focused unit tests precede UI
  integration; full checks are required before handoff.
- IV. Explicit Recovery Paths: PASS — processing, empty, failure, and manual
  entry states are specified.
- V. Focused, Reviewable Changes: PASS — only OCR utilities, the schedule form,
  dependency metadata, and feature docs change.

## Project Structure

### Documentation

```text
specs/001-client-ocr-capture/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/schedule-capture-ui.md
├── quickstart.md
└── tasks.md

docs/superpowers/
├── specs/2026-07-18-client-ocr-capture-design.md
└── plans/2026-07-18-client-ocr-capture.md
```

### Source Code

```text
src/components/app/
├── ScheduleWorkspace.tsx          # existing schedule-add UI integration
├── schedule-text-parser.ts        # extracted pure message-to-field parser
├── schedule-text-parser.test.mjs  # parser regression coverage
├── image-ocr.ts                   # image validation/resizing and worker call
└── image-ocr.test.mjs             # browser-independent OCR utility coverage
```

**Structure Decision**: Keep form state and user interaction in the existing
workspace component. Extract deterministic parser and image/OCR helpers so
they can be tested without rendering the whole application.

## Phase 0: Research

See [research.md](./research.md). The chosen worker supports JavaScript and
WebAssembly browsers, uses a Web Worker, and is lazy loaded. Client-only
processing meets the privacy constraint better than cloud OCR and is broader
than the current `TextDetector` path.

## Phase 1: Design

See [data-model.md](./data-model.md),
[schedule-capture-ui.md](./contracts/schedule-capture-ui.md), and
[quickstart.md](./quickstart.md).

## Post-Design Constitution Check

All five principles remain satisfied. The 10MB and 2048px limits bound mobile
resource use without adding persistence or external services. Direct Safari and
Samsung Internet execution is an evidence limitation, not a claimed pass, when
those browsers are unavailable to the test environment.
