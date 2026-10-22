# Fitness Capture Companion

A small TypeScript full-stack assessment project: record a private meal/workout note now, review its details later, and copy plain text into a separate tracking app. It is a new, isolated project. Travel Recovery Companion is not a dependency and was not changed.

## What works

- Lightweight ChatGPT sign-in, server-side ownership checks on every read and write, durable D1/SQLite storage.
- Text capture and browser speech recognition → editable transcript → save.
- Original note saved immediately; optional food serving amounts and workout fields can be completed later on the same entry.
- Strength (exercise, sets, reps, weight) and cardio (activity, duration, distance).
- Review and edit notes or individual fields, plain-text copy/paste, explicit mark-as-logged and move-back-to-inbox actions.
- Copying never marks an entry logged. Unsaved edits must be saved/discarded before copying or marking logged.
- Safe capture retry using a client UUID, stale-write protection using versions, useful errors retaining the draft.

There is no nutrition estimation, nutrition database, coaching, dashboard, photo capture, third-party fitness integration, or profile/settings surface. File download was removed at the user's request.

## Run locally

Use Node **24+** (tests use Node's native TypeScript and SQLite support), npm, and Git. No API keys or paid providers are needed.

```sh
npm ci
npm run build
npm run db:local
npm run dev -- --port 5178 --hostname 127.0.0.1
```

Open `http://127.0.0.1:5178`. Click **Sign in with ChatGPT**. The portable starter simulates a synthetic local account (`seedy@sites.test`) on loopback only; it is not a production authentication method. It is excluded from production builds. Never expose the development server publicly. Hosted sign-in/session verification is owned by Sites dispatch, which supplies trusted per-Site user IDs. User emails are not database ownership keys.

The build generates `dist/server/wrangler.json`, needed for the local migration. `npm run db:local` applies migrations via Wrangler's migration ledger; it is safe to rerun. Local database files are ignored under `.wrangler/state` and are separate from the hosted database. Sign out from the UI to inspect the anonymous state. `npm start` previews the compiled Worker; it does not provide the local simulated sign-in.

```sh
npm test
npm run typecheck
npm run build
```

Tests use only synthetic notes and users, and execute the production SQL against real SQLite. See [validation](docs/VALIDATION.md) for exact coverage and browser limits.

## Assessment walkthrough / code ownership

Product logic is concentrated in a few files:

| File | Responsibility |
| --- | --- |
| `lib/entries.ts` | Entry types, conservative extraction, clarification validation, text formatting |
| `lib/store.ts` | Parameterized owner-scoped SQLite statements and optimistic updates |
| `lib/api.ts` | Auth-required request handling, validation, same-origin mutations, capture idempotency |
| `app/api/entries/` | Thin server adapter from verified platform identity and D1 to the API logic |
| `app/capture-app.tsx` | Capture, inbox, API errors, clipboard, explicit logged transitions |
| `app/entry-review.tsx` | Optional detail editing, note editing, original capture, export preview |
| `lib/voice.ts`, `app/use-voice.ts` | Testable speech lifecycle and React integration |
| `db/schema.ts`, `drizzle/` | Schema and migration history |
| `tests/` | Domain, real-SQLite API, and speech failure/retry tests |

The React interface, domain model/parser, SQL persistence, API logic and tests were created for this task with AI assistance and should be reviewed/explained by the candidate. The platform starter supplies Vinext (Next-compatible React on Cloudflare), ChatGPT auth helpers, Worker entrypoint, and the build/preview/hosting scripts. Its generic dependencies are retained in the lockfile; unused starter UI examples and components were removed. The starter scripts are infrastructure, not business logic.

Data flow: browser submits a UUID and note → server obtains verified user ID → validates origin/input → saves note plus explicitly extracted details → returns entry → optional edits update that owner/ID/version → clipboard formatting is local and never writes logged state. The original capture is immutable. Editing the saved note re-extracts and replaces its details; the UI warns before that action.

## Extraction limits and voice privacy

Extraction uses transparent rules, **not an LLM**. Prefer one food/exercise per comma, semicolon, or new line. Supported examples:

```text
2 eggs, 1/2 cup rice; chicken
Squat 3x5 at 60 kg; Run 20 min 3 km
Bench press 3 sets of 8 reps
```

Unknown amounts remain empty; no foods/servings are inferred from a nutrition database. Compound text such as `mac and cheese` stays intact. Arbitrary conversational sentences, unusual units, speech punctuation, and complex workout notation may need manual editing. The full original note remains available even when structured extraction is imperfect. This is a deliberate tradeoff to keep the assessment small, explainable, and free of paid API setup; there is no hidden AI-provider integration.

Voice requires a browser that implements the SpeechRecognition/Web Speech interface, typically a secure origin/localhost and microphone permission. Support and accuracy vary; text remains available. The browser may transmit audio to its speech provider. This is disclosed before recording. This app does not upload, store, or retain raw audio. Recording is bounded to 60 seconds. Test with synthetic speech first; no personal audio was used during development.

## Deployment / access

This project has its own `.openai/hosting.json` identity and separate D1 database. The Sites source workflow builds, commits, pushes, packages, and deploys that exact source. The initial site stays **owner-private**; evaluator access has not been broadened. The app also enforces per-user entry ownership independently of the hosting audience. Sharing with an evaluator is a separate access decision.

No GitHub mirror was created: the local GitHub CLI's saved credentials are invalid. Sites provides its own project-scoped source repository; publishing results are recorded in the handoff. No Travel credentials, providers, database, repository, or deployment were copied.

## Incomplete / intentionally bounded

- Browser/vendor speech recognition is a compatibility dependency; no paid transcription fallback or realtime voice conversation.
- No general-purpose AI understanding: explicit rule-based extraction with manual correction.
- No password management or custom auth stack; hosted auth depends on Sites.
- Cross-account hosted identity and actual microphone hardware need explicit hands-on verification beyond synthetic integration tests.
- Owner-private hosting must be shared before an evaluator can access it. No assessment was submitted and no external people were messaged.
