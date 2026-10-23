# Validation — matching-stack fitness app

Verified locally on 2026-10-23. All notes, accounts and speech fixtures are synthetic.

- Initial full suite: **51 tests passed across 11 files**, with the real local account test enabled. After deployment compatibility changes: **62 ordinary tests pass**, and the real local integration is separately re-run (the ordinary run skips it). Production TypeScript/Vite build passes. Bundle-size warning remains (~552 kB JavaScript before gzip).
- Domain/server/UI/client boundary tests pass, including auth denial, fake-provider timeout/refusal/invalid output, same-entry clarification, original-note preservation, copy/log separation, voice failure/retry/cleanup and draft races.
- Actual local Supabase Auth/PostgREST integration passes: two accounts, capture idempotency, cross-owner entry/message denial, saved reply idempotency, editing, original preservation, explicit logged/undo, stale-write rejection and a fresh login restoring conversation/details.
- Actual disabled Edge endpoint returns 503 analysis_disabled with an authenticated user. No paid model invocation was made.
- PostgreSQL rollback fixtures pass: owner RLS, immutable original, stale user/model rejection, duplicate reply/claim prevention, logged/undo retaining pending clarification, expired processing takeover and rejection of a replaced worker.
- Edge Deno typecheck passes with manual node_modules resolution.
- Specification and quality reviews found and prompted fixes for draft-clearing races, hidden reply drafts, stale selection/list updates, log-state clarification loss and unrecoverable processing claims.

## Incomplete verification

- Live browser walkthrough and responsive viewport checks: started in the user's local Brave browser, but repeated connection timeouts prevented completion. Browser retries/permission attempts were stopped. No screenshot is claimed as completed-flow proof.
- Real microphone/vendor speech service: not exercised. Simulated lifecycle tests cover failures/retry/cleanup; they do not establish hardware compatibility.
- Live OpenAI extraction: not exercised; new-project paid API authorization and secure provider setup are pending. Fake-provider tests verify orchestration, not model accuracy.
- Private GitHub source is verified at https://github.com/asawyers/fitness-capture-companion (`main`). Separate Vercel project is created and linked, but no deployment exists yet. Public evaluator deployment/source access: not configured for this version. Old owner-private Sites preview stays unchanged.

Run commands and environment setup are in README.md. Local integration creates synthetic accounts in the isolated local stack; fixtures run inside rolled-back transactions. Do not point the integration test at a hosted database.

Deployment preparation: official Supabase key migration guidance prompted support for `SUPABASE_PUBLISHABLE_KEYS.default` and in-function JWT verification. Authentication denial remains tested; hosted asymmetric-token compatibility remains pending live backend provisioning.
