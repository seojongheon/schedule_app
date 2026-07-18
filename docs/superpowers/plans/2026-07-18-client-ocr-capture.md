# Client-side OCR capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recognize message screenshots locally in the browser and use reviewed
text to fill eligible schedule fields without changing schedule titles.

**Architecture:** A lazily loaded browser worker validates and resizes a chosen
image, returns Korean/English OCR text, and hands that text to the existing
reviewed-text parser. The form owns user-facing state and preserves the manual
text-entry route for all failures.

**Tech Stack:** Next.js 15, React 19, TypeScript, `tesseract.js`, Node test
runner, Tailwind CSS.

## Global Constraints

- OCR image/text processing stays in the browser and is never sent to an OCR
  service.
- Chrome, Safari, and Samsung Internet use the same WebAssembly + Web Worker
  route; direct-test gaps must be reported honestly.
- OCR never fills the schedule title.
- Files over 10MB and images above a 2048px edge are bounded before OCR.
- Existing fields are not erased when a value cannot be parsed.

### Task 1: Extract and protect parsing behavior

**Files:**
- Create: `src/components/app/schedule-text-parser.ts`
- Create: `src/components/app/schedule-text-parser.test.mjs`
- Modify: `src/components/app/ScheduleWorkspace.tsx`

- [ ] Write tests for a message containing date, time range, address, Korean
  mobile number, cost, and arbitrary text; assert title is absent and missing
  fields are undefined.
- [ ] Run `npm run test:unit`; confirm the new import fails before extraction.
- [ ] Move `parseScheduleText()` and time/price helpers into the focused module
  and import its typed result into the workspace component.
- [ ] Run `npm run test:unit`; confirm parsing assertions pass.
- [ ] Commit `test: protect schedule message parsing`.

### Task 2: Build local OCR helper

**Files:**
- Create: `src/components/app/image-ocr.ts`
- Create: `src/components/app/image-ocr.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Write tests for image-size validation and 2048px resize dimensions.
- [ ] Run `npm run test:unit`; confirm helper tests fail before implementation.
- [ ] Add the local OCR dependency, validate image input, resize through a
  canvas, lazily create a Korean/English worker, recognize text, and terminate
  the worker in `finally`.
- [ ] Return typed `success`, `empty`, `unavailable`, and `failed` results;
  never make a network request from application code.
- [ ] Run `npm run test:unit`; confirm helper and parser tests pass.
- [ ] Commit `feat: add local image OCR helper`.

### Task 3: Integrate capture feedback into the schedule-add form

**Files:**
- Modify: `src/components/app/ScheduleWorkspace.tsx`

- [ ] Replace the `TextDetector` capture path with the helper result contract.
- [ ] Disable duplicate capture while recognition runs; show progress and every
  recovery message; retain manual textarea and automatic-input action.
- [ ] On OCR success, set reviewed text and invoke the existing parser once;
  on all non-success results, preserve current form fields.
- [ ] Run focused tests, typecheck, and lint; inspect the form in Chrome.
- [ ] Commit `feat: add browser-local schedule screenshot OCR`.

### Task 4: Verify and document browser evidence

**Files:**
- Modify: `specs/001-client-ocr-capture/quickstart.md`
- Modify: `specs/001-client-ocr-capture/tasks.md`

- [ ] Run full unit tests, typecheck, lint, and production build.
- [ ] Execute the screenshot flow in Chrome and record its observed result.
- [ ] Check Safari and Samsung Internet direct-execution availability and record
  an explicit not-run status if either browser is unavailable.
- [ ] Run `git diff --check` and commit final verification documentation.
