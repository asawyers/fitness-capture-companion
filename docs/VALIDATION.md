# Validation evidence — 2026-10-22

## Automated

`npm test`: 17 passing tests. Tests were written before implementation and observed failing; implementation then made them pass.

- Explicit food/serving extraction, preserved ambiguous compounds, missing quantities without estimates.
- Strength sets/reps/weight and cardio duration/distance; optional same-item clarification and export formatting.
- Anonymous API rejection, owner-scoped list/direct read/update, rejection of client-supplied user IDs.
- SQLite durability across database close/reopen, immutable original capture, stable IDs, idempotent capture retry.
- Explicit logged/unlogged updates; stale-version conflicts; same-origin, JSON, length and shape validation.
- Speech recognition denial, no-speech/network failures, fresh-session retry, start failure, transcript snapshot replacement without duplication.

`npm run typecheck`: passing with strict TypeScript.

`npm run build`: production Worker build succeeds. A final build is run again by the publication workflow for the exact source pushed. The starter emits a Node deprecation notice; it does not fail the build.

A separate read-only reviewer found an unsaved-review-edit issue: copying could export stale data and marking logged could reset local edits. Fixed by blocking copy/log actions until edits are saved/discarded. Verified disabled buttons and save/discard behavior in Brave. No other concrete security/persistence issue was identified in that review.

## Local browser QA — Brave on the user's Mac

Used only synthetic notes in the loopback development account:

- Anonymous landing screen → local sign-in → private capture screen.
- Saved `2 eggs, 1/2 cup rice; chicken` without optional answers. One inbox row; missing chicken serving stayed empty.
- Added `150 g` to that entry. Same ID, one row, original capture preserved.
- Copied meal text and read the resulting clipboard text. All three explicit amounts present, status still **To log**.
- Explicitly marked logged, inspected Logged filter, moved back to inbox.
- Edited the saved note to include `150 g chicken`; details re-extracted, original retained.
- Captured `Squat 3x5 at 60 kg; Run 20 min 3 km`. Correct strength and cardio fields; copied text contained both.
- Reloaded and confirmed both saved entries survived.
- At 390 × 844 viewport: document content width 375, viewport 390 (no horizontal overflow); changed squat sets to 4 and saved successfully. Temporary viewport override reset afterward.
- Confirmed unsaved serving/workout changes disable Copy and Mark as logged and present save/discard guidance.
- Download feature removed at user's request. No further download actions or tests attempted.

## Verification limits

- No real personal meal/workout information or microphone audio was used.
- Actual microphone hardware/provider transcription and permission dialogs are not claimed tested. The recording lifecycle and failures were simulated in unit tests; voice remains browser/vendor dependent.
- Local account sign-in uses the platform starter's loopback-only mock. Hosted session verification is dispatch-owned; a second real hosted account has not been tested. Database/API isolation was tested with two distinct synthetic identities against real SQLite.
- Hosting remains owner-private; evaluator access has not been changed.

## Hosted publication and local setup

The separate owner-private deployment succeeded at https://fitness-capture-companion.flowy-gem-9293.chatgpt.site. Brave confirmed the live authentication gate and the correct Fitness Capture Companion ChatGPT sign-in flow. OpenAI then required the user’s password, so authenticated hosted capture remains pending user login; the sign-in tab was left ready. No password was read or entered.

Corrected the generated Wrangler configuration’s migration directory to resolve from `dist/server`. Applied migrations successfully to a fresh disposable local database, then reran the same command and confirmed `No migrations to apply!`.
