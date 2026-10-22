# Minimal AI and evaluator-readiness plan

Earlier technical preparation. The planning reset is captured in `../specs/2026-10-22-fitness-capture-design.md`. Treat its scope and user decisions as the current discussion; model and cost numbers below require rechecking before any approved execution.

Status: preparation only. The current deployment is a working rules-based preview, not assessment-ready. Paid OpenAI use and the proposed $5 testing budget are awaiting user approval in the parent conversation. No paid calls, credentials, audience changes, invitations, or product changes are authorized by this plan alone.

## Verified current state

- Separate project: `appgprj_6ada8965f0208191ab7c3d596cd580f9`.
- Preview: https://fitness-capture-companion.flowy-gem-9293.chatgpt.site
- Sites reports owner role; current `custom` audience has no non-owner viewers. Both `custom` and `public` are available; external invitations are supported.
- The public-compatible landing page, top-level ChatGPT sign-in, server identity adapter, and owner-scoped API already exist. Public hosting would not require a new auth stack or a shared inbox. It must still be verified with two hosted identities after an authorized audience change.
- Current local tests cover synthetic cross-user SQLite isolation. Hosted sign-in reaches OpenAI's password screen and awaits the user; no password has been read or entered.
- No OpenAI API key setup capability is currently installed/callable. The Sites identity/secrets guide requires the OpenAI Developers plugin's `openai-platform-api-key` workflow before configuring `OPENAI_API_KEY`.

## Evaluator access: smallest supported choices

Recommended for a URL-based assessment: after explicit audience authorization, set this existing Site's access mode to `public`. Anonymous visitors see the sign-in page only. Evaluators sign in with their own ChatGPT accounts and get independent private entries. Keep every API operation authenticated and owner-scoped; do not add a shared demo user. Public UI does not mean public records.

Alternative for named reviewers: keep `custom` and add only approved evaluator email addresses. This can send invitations, so recipients and permission to invite must be explicit. No invitation was sent.

Neither option makes the source repository public. The existing Sites Git repository is private. Evaluator source access must also be arranged, for example a separate GitHub mirror after working GitHub authorization and source-sharing approval. Do not touch Travel's repository. Current `gh` saved credentials were invalid during setup.

## Minimal real AI implementation

Keep one inference adapter, one owner-scoped analysis endpoint, and the existing capture/review UI. No agent framework, background job service, chat screen, tools, nutrition estimates, or additional provider.

1. Keep `POST /api/entries` fast and deterministic: persist the original note first and immediately return its ID. Client visibly confirms the save before requesting analysis. Rules remain an explicitly labeled fallback, not presented as AI.
2. Add `lib/ai.ts` with a server-only OpenAI Responses request using strict JSON Schema and `store: false`. Candidate: `gpt-4.1-mini`, a small model supporting structured output. Verify selected account access/model pricing during approved setup; pin a supported snapshot then. No API key in source, browser bundle, URL, logs, or hosting manifest.
3. Define a bounded result: foods with explicitly stated serving amounts, strength fields, cardio fields, and optional questions referencing an item and a missing field. Preserve compound foods and ambiguity. Treat note text as data, never instructions. No nutrition or coaching fields are allowed.
4. Validate both shape and evidence server-side. Require exact note spans for each stated food/exercise and quantity. Missing/unsupported amounts remain blank. Reject unsupported invented items or portions; preserve the note and show analysis failure/retry instead of silently applying fabricated output. Structured Outputs guarantees shape, not factual correctness.
5. Add `POST /api/entries/[id]/analyze`: obtain verified user ID, select that owner's saved note, enforce same-origin JSON, reserve a bounded run, call the adapter, validate, then update the same entry using its expected version. Late AI results cannot overwrite a user's edits or clarify a different version. Never write logged state from AI.
6. Persist a minimal analysis result/status and question references with an additive migration. Record run identity/status to make a lost-response retry idempotent; failed explicit retries consume the same bounded testing allowance. Avoid automatic retry loops.
7. Render optional AI questions beside the existing item fields. Submit answers through the existing clarification path to the same entry ID. Saving an answer changes that item's field only; no duplicate entry and no forced follow-up. Keep copy/paste and explicit logged status unchanged.
8. If analysis is unavailable, times out, refuses, produces invalid data, or hits the test allowance, keep the saved note and manual fields usable, explain the failure, and offer an explicit retry when allowed.

## Bounded approved testing, after approval and key setup

The proposed authorization is a $5 ceiling, not permission for open-ended public inference. Start much smaller: at most 20 provider attempts across this Site, enforced atomically in D1 before calls, including failed/time-out attempts. Cap note/prompt/schema input bytes and output tokens, disable SDK automatic retries, and verify a conservative worst-case cost from current model pricing before enabling the route. Enforce a per-user cooldown as well. Stop when the attempt allowance is exhausted; no automatic refill. No other usage may share this key during the bounded test.

Suggested initial limits are 24,000 total UTF-8 input bytes, 1,500 output tokens, and 20 attempts. At the inspected GPT-4.1-mini standard prices ($0.40/M input and $1.60/M output tokens), even a conservative one-token-per-input-byte upper bound is $0.012 per attempt, $0.24 total; reserve $0.02 per attempt for headroom. Recheck pricing/model identity before execution. A provider budget alert alone must not be represented as a hard cap.

Disclose before personal-data testing that saved note text/transcripts are sent to OpenAI for extraction. `store: false` disables stored response state; do not promise zero provider retention. Browser speech processing remains separately disclosed. Start with synthetic inputs only and no real microphone audio.

## Verification / precise next actions

1. Receive explicit OpenAI-use and $5 test-budget approval; independently receive public-audience permission or named invite recipients/permission. These approvals are currently pending, not denied.
2. Enable the OpenAI Developers plugin and run its `openai-platform-api-key` secure setup workflow for this separate fitness project. Do not reuse or inspect Travel's key. Configure the resulting key as a secret `OPENAI_API_KEY` using Sites runtime environment settings. Do not paste keys into chat.
3. Implement/test the small changes above with a fake provider first: varied meal sentences, missing amounts, ambiguous meals, strength/cardio, unsupported/invented model output, refusal/timeouts, quota exhaustion/concurrent calls, duplicate retry, stale result after edit, and cross-user analysis rejection.
4. After secure setup, run the bounded synthetic live tests. Deploy to this same separate project and apply only the authorized access choice.
5. User completes hosted OpenAI sign-in. Verify real capture/analysis/clarification/persistence/copy/logged flows with two hosted users and evaluator reachability. Arrange source access separately. Keep hardware speech verification clearly marked until actually tested.

## References inspected

- Local Sites guide: `skills/sites/references/identity-and-secrets.md` and native access configuration tools.
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/models/gpt-4.1-mini

Only this plan was added in this preparation step. The current deployment and audience are unchanged.
