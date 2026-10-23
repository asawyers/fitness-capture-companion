# Fitness Capture Companion

A deliberately small assessment project: save a private meal or workout note, optionally clarify its details, then copy it into your usual tracker. Copying never marks a note logged; that is a separate action.

## Stack and boundaries

React 19, Vite, TypeScript, Tailwind, Supabase email/password Auth and Postgres, a TypeScript/Deno Edge Function, Zod, and one bounded OpenAI Agents SDK response. Vitest tests the domain, server, UI and client integration. This is a separate fitness project; Travel Recovery Companion is not a dependency and was not modified.

The app supports foods/amounts, strength exercise/sets/reps/weight, and cardio activity/duration/distance. Entries and their user/assistant conversations persist under the signed-in account. Notes save before AI runs. Follow-ups update the same entry; all structured fields remain editable. Unknown quantities stay empty. Export is copy/paste only.

No nutrition estimates, coaching, photos, dashboards, fitness integrations or profile/settings features.

## Run locally

Prerequisites: Node **24**, npm, Docker, Supabase CLI and Deno. Use a separate Supabase project for hosted use. No OpenAI key is needed for capture, account persistence, editing or copying.

```sh
npm ci
supabase start --exclude realtime,storage-api,imgproxy,postgres-meta,studio,logflare,vector,supavisor
supabase migration up --local
cp .env.example .env.local
# Fill the three browser-safe values below from your LOCAL Supabase status.
npm run dev
```

Open `http://127.0.0.1:5173`. Create a synthetic email/password account. The local Supabase stack uses project ID `fitness-capture-assessment` and ports 55420–55430; it does not share Travel's database. Local email confirmation is disabled in the development config; hosted verification settings must be chosen and tested separately.

`.env.local` (ignored):

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:55421
VITE_SUPABASE_PUBLISHABLE_KEY=<local anon or publishable key>
VITE_FITNESS_API_URL=http://127.0.0.1:55421/functions/v1/fitness
```

Only browser-safe public Supabase keys belong here. Never use a service-role key or OpenAI key in a `VITE_` variable. The Edge Function verifies the bearer token with Supabase Auth (`getUser`); the gateway legacy-JWT check is disabled to support modern signing keys. The database and Edge Function verify the actual user; a public key does not grant access to private entries.

## Optional AI setup

The user approved up to **$5 for synthetic testing**. The model (`gpt-4.1-mini`), enablement and approved frontend origins are hardcoded in `supabase/functions/fitness/index.ts`, as requested. Only `OPENAI_API_KEY` is a server secret. No key is present in source or browser configuration; without it, analysis is unavailable and manual capture/edit/copy still work.

Configure a new fitness-specific `OPENAI_API_KEY` on the separate fitness Supabase project's Edge Function secrets page. For local testing, place only that credential in an ignored env file and run `supabase functions serve fitness --env-file <your-ignored-env-file>`. Never commit the file. The user configured the server key and resolved the initial OpenAI quota issue. Live synthetic meal extraction, optional quantity clarification on the same entry, and mixed strength/cardio extraction have passed. No further paid calls are part of publication. Do not reuse Travel's credentials.

The request sends the selected entry's note, saved details and conversation to OpenAI. One structured response is allowed, with no tools, retries, hosted conversations or SDK tracing; response storage is disabled. This does not override the provider's own processing policies. Use synthetic notes first. Validation rejects unsupported detail kinds and values absent from the supplied text/details. Model extraction can still need manual correction.

The original capture and replies remain saved if AI fails or is unavailable. A 60-second processing lease allows retry after an interrupted request. Optimistic versions prevent stale AI output overwriting a newer edit. With AI disabled, add/edit fields manually; automatic extraction and follow-up generation are unavailable.

## Voice privacy and limits

Choose **Use device dictation** to focus the input and see iPhone keyboard microphone or Mac Dictation shortcut instructions. The website cannot launch system dictation itself. This app receives the resulting text without uploading or retaining raw audio. Browser recording remains a separate option: tap Record, read the disclosure, then start recording. The browser's speech service may process audio; recognition stops after 60 seconds. Some browsers, including Brave, expose the API without a working transcription service. Errors preserve drafts and point to device dictation or typing. Actual microphone/vendor compatibility remains unverified.

Desktop capture sits above an inbox list and selected-entry review. Mobile uses Capture/Inbox navigation and Back to inbox; drafts stay mounted while switching views. Review puts structured details and optional clarification before copy/log actions, with saved notes and conversation available in expandable sections.

## Validation

```sh
npm test
npm run build
npm run check:edge
# Isolated responsive UI checks with synthetic fixtures; no real accounts/API calls.
# Uses Brave headless by default; override with your installed Chromium executable:
npm run test:e2e
# Requires the local stack and .env.local; creates synthetic local accounts only:
FITNESS_LOCAL_INTEGRATION=1 npm run test:integration
# Transactional database checks (rollback their fixtures):
docker exec -i supabase_db_fitness-capture-assessment psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/backend/database.sql
docker exec -i supabase_db_fitness-capture-assessment psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/backend/database-logging.sql
docker exec -i supabase_db_fitness-capture-assessment psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/backend/database-recovery.sql
```

The ordinary suite skips the actual local HTTP account test unless explicitly enabled. See [validation evidence and limits](docs/VALIDATION.md). Synthetic headless responsive checks are separate from a real-device microphone walkthrough. Automation of the user's signed-in browser remains paused.

## Walkthrough and code ownership

- `src/App.tsx` and `src/features/`: login, mobile notebook, capture, review, copy/log distinction and voice lifecycle.
- `src/lib/use-fitness.ts`: account lifecycle, draft-safe mutations, retry IDs and asynchronous selection guards.
- `src/lib/repository.ts`: typed caller-scoped database adapter.
- `supabase/migrations/`: ownership policies, immutable originals, transactional captures/chats, idempotency, versions and recoverable analysis claims.
- `supabase/functions/_shared/domain/`: shared Zod contracts and plain-text formatting.
- `supabase/functions/_shared/server/`: verified authentication, bounded agent and analysis orchestration.
- `tests/`: synthetic domain/UI/server cases, real local Auth/PostgREST account isolation, and transactional PostgreSQL fixtures.

Data flow: sign in → save note and initial message atomically → optional authenticated analysis → save a reply to the same entry → review/edit → copy saved text → explicitly mark logged. A reload restores entries and messages from the account. Sign-out clears private UI state.

AI assisted implementation and review. The candidate should inspect and understand this code before presenting it. The earlier Sites/Vinext preview remains in Git history; its runtime was removed from this assessment worktree.

## Delivery status

The production URL target is [fitness-capture-companion.vercel.app](https://fitness-capture-companion.vercel.app). Source is in the separate private repository [asawyers/fitness-capture-companion](https://github.com/asawyers/fitness-capture-companion), default branch `main`. Hosting uses Vercel project `rito-labs-2cc43421/fitness-capture-companion` and the user's separate Personal Supabase project `dsgswbvoifmfcscujfjr`.

A bounded hosted check confirmed frontend HTTP 200, production-origin CORS preflight HTTP 204, and anonymous backend denial HTTP 401. The latest backend configuration update is therefore serving. The database migrations were applied, and the security advisor returned no findings after restricting a preinstalled public event-trigger function.

Verified through hosted APIs: synthetic sign-in, original capture, deduplication, AI extraction, same-entry clarification, persisted conversations, editing, logged/undo, restored sessions, and cross-account entry/chat denial. Deliberate version/ownership conflicts use HTTP409 to avoid transaction retries. Synthetic responsive browser checks cover the refreshed layout independently of those hosted APIs. Still incomplete: hosted email-confirmation/evaluator signup, real-device microphone verification, and evaluator access to private source. The historical owner-private Sites preview and Travel remain unchanged. No assessment was submitted or external people messaged.

Hosting account: `ajsawyers22`, Rito Labs (`rito-labs-2cc43421`). The earlier alternate-account Vercel project was deleted at the user’s request. The separate GitHub source and Personal Supabase backend remain in place.
