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

Only browser-safe public Supabase keys belong here. Never use a service-role key or OpenAI key in a `VITE_` variable. The database and Edge Function verify the actual user; a public key does not grant access to private entries.

## Optional AI setup

AI is implemented but **disabled by default**. Paid API use has not yet been authorized or verified for this fitness project. Do not reuse Travel's provider credentials or approvals.

After authorization, configure server-only Edge secrets: `OPENAI_API_KEY`, `FITNESS_OPENAI_MODEL`, `FITNESS_AI_ENABLED=true`, and `FITNESS_ALLOWED_ORIGIN` equal to the exact frontend origin. For local testing place them in an ignored env file and run `supabase functions serve fitness --env-file <your-ignored-env-file>`. Never commit that file. For hosted use configure secrets on the separate fitness Supabase project.

The request sends the selected entry's note, saved details and conversation to OpenAI. One structured response is allowed, with no tools, retries, hosted conversations or SDK tracing; response storage is disabled. This does not override the provider's own processing policies. Use synthetic notes first. Validation rejects unsupported detail kinds and values absent from the supplied text/details. Model extraction can still need manual correction.

The original capture and replies remain saved if AI fails or is unavailable. A 60-second processing lease allows retry after an interrupted request. Optimistic versions prevent stale AI output overwriting a newer edit. With AI disabled, add/edit fields manually; automatic extraction and follow-up generation are unavailable.

## Voice privacy and limits

Tap Record, read the disclosure, then start recording. Browser speech recognition produces editable text; saving is separate. The browser's speech service may process audio. This app stores only submitted text and does not upload or retain raw audio. Recognition stops after 60 seconds; unsupported browsers and permission/network failures retain typed text and offer retry. Actual microphone/vendor compatibility remains unverified. Text capture works independently.

## Validation

```sh
npm test
npm run build
npm run check:edge
# Requires the local stack and .env.local; creates synthetic local accounts only:
FITNESS_LOCAL_INTEGRATION=1 npm run test:integration
# Transactional database checks (rollback their fixtures):
docker exec -i supabase_db_fitness-capture-assessment psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/backend/database.sql
docker exec -i supabase_db_fitness-capture-assessment psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/backend/database-logging.sql
docker exec -i supabase_db_fitness-capture-assessment psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/backend/database-recovery.sql
```

The ordinary suite skips the actual local HTTP account test unless explicitly enabled. See [validation evidence and limits](docs/VALIDATION.md). Browser walkthrough remains unfinished after browser automation connection failures; repeated browser permission attempts were stopped at the user's request.

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

This matching-stack version runs locally and has not been deployed. A separate fitness GitHub repository, Vercel project, hosted Supabase project, provider authorization and live evaluator-account verification remain outstanding. The historical owner-private Sites preview is a different revision and is not evidence that this assessment version is deployed. No assessment was submitted and no external people were messaged.
