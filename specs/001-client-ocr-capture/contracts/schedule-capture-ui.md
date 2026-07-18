# Schedule capture UI contract

## Input

- The schedule-add form accepts one user-selected image file.
- Non-image, empty, undecodable, and over-limit files produce a recovery
  message and do not mutate schedule fields.

## Processing states

| State | User-visible result | Form behavior |
|---|---|---|
| processing | Recognition progress text | capture control disabled; manual text remains visible |
| success | Count of filled eligible fields | recognized text displayed and eligible fields filled |
| empty | No readable text message | existing values preserved; text remains editable |
| unavailable | Local OCR unavailable message | manual paste + automatic input remains available |
| failed | Recognition failure message | existing values preserved; manual paste remains available |

## Output

- Success places recognized text into the existing message textarea.
- Success applies the existing text parser once.
- The schedule title is never mutated by capture processing.
