# Client-side OCR capture design

## Goal

When someone adds a schedule, they can select a message screenshot, extract its
text in the browser, review that text in the existing message input, and apply
the existing parser to fill the date, time, address, customer phone number,
estimated cost, and additional information. Schedule titles remain manual.

## Scope

- Process the selected image entirely in the browser; do not upload it or send
  it to an OCR service.
- Support current Chrome, Safari, and Samsung Internet through a WebAssembly
  OCR worker rather than relying on the browser-specific `TextDetector` API.
- Load OCR code and Korean/English language data only after a user chooses an
  image.
- Keep the text area and manual "자동 입력" action as the review and recovery
  path.
- Make processing, unsupported capability, empty-result, and failure states
  clear to the user.

## Non-goals

- Do not infer or fill the schedule title.
- Do not send images or recognized text to a server or third party.
- Do not change the existing field-parsing rules beyond feeding them OCR text.
- Do not promise exact recognition for blurred, obstructed, or handwritten
  screenshots.

## User flow

1. The user chooses a screenshot from the schedule-add form.
2. The client checks the file type and prepares a resized browser-local image.
3. A lazily loaded OCR worker recognizes Korean and English text.
4. The recognized text appears in the message text area.
5. The existing parser fills eligible schedule fields and reports how many were
   filled.
6. The user reviews and may correct both the text and the form before saving.

## Browser and failure behavior

- Chrome, Safari, and Samsung Internet use the same WebAssembly + Web Worker
  OCR path.
- If WebAssembly, workers, or image decoding are unavailable, the form keeps
  manual text input available and explains that OCR is unavailable.
- If the selected image yields no text or worker setup fails, the form keeps
  the image private, shows an actionable message, and leaves existing form
  values unchanged.
- OCR workload is bounded by file validation and image resizing so an original
  camera image does not unnecessarily consume mobile memory.

## Validation

- Unit tests cover OCR-result handoff and existing extraction of date, time,
  address, phone, cost, and additional information.
- Browser validation exercises the supported path in Chrome.
- Safari and Samsung Internet are assessed against the WebAssembly + Worker
  runtime requirements. If no runnable instance is available in this
  environment, the final verification report must explicitly say that their
  direct execution test was not run rather than claiming a pass.
