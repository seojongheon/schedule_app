# Data Model: Browser-local OCR capture

## OCR Capture

Temporary client-only state; never stored with the schedule.

| Field | Meaning | Validation |
|---|---|---|
| `status` | idle, processing, success, empty, unavailable, or failed | exactly one state |
| `message` | user-facing progress or recovery copy | present for non-idle terminal states |
| `text` | recognized text shown in the existing textarea | may be empty only for empty/failed states |

## Parsed Schedule Details

Existing temporary form values derived from reviewed text.

| Field | Source behavior |
|---|---|
| date | fill only if text yields a date |
| startTime/endTime | fill only if text yields a time or time range |
| address | fill only if text yields an address-like line |
| customerPhone | fill only if text yields a Korean mobile number |
| estimatedPrice | fill only if text yields a cost |
| additionalInfo | retain reviewed text |
| title | never filled by OCR/parser |

Existing values stay intact when the corresponding parsed value is absent.
