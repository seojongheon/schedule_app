# Quickstart: Browser-local screenshot OCR validation

## Prerequisites

- Node dependencies installed with `npm install`
- A clear Korean message screenshot containing a date, time range, address,
  Korean mobile number, and cost

## Automated checks

```bash
npm run test:unit
npm run typecheck
./node_modules/.bin/eslint . --ext .ts,.tsx --no-eslintrc --config .eslintrc.json
npm run build
```

**Recorded on 2026-07-18:** all four commands passed. The production build
also reports a non-blocking ESLint plugin-resolution warning because this
isolated worktree is nested below another checkout; the explicit ESLint command
above passed with this worktree's configuration.

## Browser exercise

1. Run `npm run dev`.
2. Sign in and open the schedule-add form.
3. Select the prepared screenshot using `캡쳐`.
4. Confirm that progress appears, text is placed in the message textarea, and
   date, time, address, phone, cost, and additional information are filled.
5. Confirm that the schedule name is unchanged, edit an extracted value, and
   save normally.

## Browser verification record

- **Codex in-app browser (2026-07-18): PASS.** The local worker read the test
  image and returned the date, time range, address, Korean mobile number, and
  cost as editable text. This directly verifies the WebAssembly-worker OCR
  path, but the browser runtime does not identify itself as Chrome.
- **Chrome: NOT DIRECTLY RUN.** No Chrome automation target was available in
  this environment. The feature uses the same JavaScript, WebAssembly, canvas,
  and worker path that Chrome supports, but this is compatibility reasoning,
  not a direct Chrome pass.
- **Safari: NOT DIRECTLY RUN.** Safari was not available in this environment.
  The feature avoids the unsupported browser-only `TextDetector` path and uses
  the shared WebAssembly-worker route; direct Safari execution remains required
  before making a production compatibility claim.
- **Samsung Internet: NOT DIRECTLY RUN.** Samsung Internet was not available
  in this environment. It is assessed through the same Chromium WebAssembly
  and worker requirements, but direct execution remains required before a
  production compatibility claim.
- **Schedule-add integration: NOT DIRECTLY RUN.** The local app required a
  valid issued account and no test credentials were provided. Unit tests cover
  text-to-field parsing, and the OCR module was exercised independently.
