# Research: Browser-local screenshot OCR

## Decision: use a lazy WebAssembly OCR worker for all targets

**Rationale**: `tesseract.js` supports JavaScript and WebAssembly environments
and uses a separate browser worker for recognition. Loading it only after image
selection avoids adding OCR startup cost to ordinary schedule creation. The
same route avoids Safari and Samsung Internet dependence on `TextDetector`.

**Alternatives considered**:

- Browser `TextDetector`: rejected because support is not consistent across the
  requested browsers.
- External OCR/AI API: rejected because it would transfer message content and
  violate the frontend-only requirement.

## Decision: resize locally before recognition

**Rationale**: message screenshots retain readable text after a 2048px maximum
edge while using less memory and worker time on phones.

**Alternatives considered**:

- Original-size processing: rejected because camera images can impose
  unnecessary mobile memory and latency costs.
- Server-side resizing: rejected by the no-upload requirement.

## Decision: retain the existing reviewed-text parser

**Rationale**: the current parser already fills date, time, address, phone,
cost, and additional information. OCR's responsibility ends at supplying text.

**Alternatives considered**:

- New AI field parser: rejected because title inference is out of scope and it
  would need external processing.
- Direct OCR-to-form mapping: rejected because reviewed text is the required
  user control and recovery surface.

## Decision: report direct browser execution separately

**Rationale**: Chrome can be exercised in the available browser environment.
Safari and Samsung Internet may not be installed, so their compatibility must
be based on the shared WebAssembly/worker requirements and explicitly labeled
as not directly executed.
