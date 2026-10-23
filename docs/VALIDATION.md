# Fitness validation

## Verified

- Ordinary suite: 118 tests pass; the opt-in local HTTP account test is skipped in the ordinary run. That local account test passed separately earlier. The UI refresh adds navigation, focus/scroll, draft preservation, text-input, immediate reply-feedback and grouped clarification regressions. Analysis lifecycle tests cover completion, failure and account changes.
- TypeScript/Vite production build and updated Edge Deno typecheck pass. The build retains a roughly565kB JavaScript bundle warning before gzip.
- Real local PostgreSQL fixtures cover owner RLS, immutable originals, idempotency, stale writes/results, persisted chat, logging/undo and recovery of interrupted analysis.
- Hosted synthetic sign-in, immediate original-note saving and capture deduplication passed.
- Live OpenAI meal extraction preserved exactly the supplied foods and left unknown quantities empty. A tested deterministic fallback supplies one optional question when the model omits it.
- A short clarification updated the same meal and persisted its conversation without duplicate replies.
- Manual corrections preserved the original note. Explicit logged/undo persisted. A fresh sign-in restored the conversation.
- Live mixed strength/cardio extraction preserved recorded sets, reps, weight, duration and distance.
- Hosted second-account reads returned no other user's entries/messages. Cross-account writes returned prompt denial after the application-conflict fix.
- The initial provider HTTP429 was resolved by the user. No additional paid AI calls are part of source/frontend publication.
- Hosted Edge version6 includes explicit batch-answer extraction instructions; the existing application-conflict migration remains unchanged. Deliberate application conflicts use PT409; real database serialization failures retain their normal handling. Owner/version predicates remain intact. Batch tests use synthetic UI fixtures and a stub agent at the server boundary; no additional paid model test was run for this update.
- Frontend public HTTP200, production-origin preflight204 and anonymous Edge401 were observed.
- Eight isolated headless Brave tests with intercepted synthetic data pass at 320px, 390px, 768px and 1280px widths. They cover list/detail layout, mobile draft preservation, normal text-field focus and removal of the device-dictation button, asynchronous row focus restoration, inbox scroll restoration, successful capture navigation, blocked unsaved replies, simulated recording/reply visibility during resize, reduced-motion loading indicators with text status labels, Enter showing immediate saving feedback followed by background-analysis feedback, and all optional questions sharing a single submission. They do not access a real account, microphone or external API. Desktop/mobile screenshots were inspected locally.

The workflow harness's final logout attempt received403/session_not_found after an earlier global logout had already revoked that session. The preceding workflow assertions passed; no paid run was repeated for that cleanup-only response.

## Remaining limits

- Real-device microphone/vendor speech compatibility remains unverified. The user observed Brave's browser speech service failure; system keyboard dictation can enter text directly, without an app-level device dictation button. Isolated responsive tests use simulated speech events, not real transcription. Automation of the user's signed-in browser stays paused.
- Hosted email-confirmation/evaluator signup remains unverified. Hosted API checks used temporary seeded synthetic accounts; verification settings were not disabled.
- Source is private; evaluator access must be arranged separately.
- The latest read-only check found2 synthetic QA users,2 entries and7 messages. They are deliberately left untouched by this publication task.
- No assessment was submitted, no external people were messaged, and Travel was not modified.

## Source and hosting

- Source: https://github.com/asawyers/fitness-capture-companion (main)
- App: https://fitness-capture-companion.vercel.app
- Vercel project: rito-labs-2cc43421/fitness-capture-companion
- Fitness Personal Supabase project: dsgswbvoifmfcscujfjr

Publication is verified against the source commit and live frontend asset after deployment. Exact final commit/deployment identifiers are reported with delivery. Setup and run commands are in README.md.
