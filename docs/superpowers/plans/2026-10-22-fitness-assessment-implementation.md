# Fitness Capture Companion Implementation Plan

> For execution after user authorization: use the Superpowers executing-plans workflow task by task. This is the implementation checklist; the separate design document records the agreed product scope. Do not interpret this document's creation as permission to implement or deploy.

**Goal:** Deliver a deliberately small, authenticated fitness capture app with persisted per-user conversations, optional AI clarification, review/edit, copy/paste and explicit logged status.

**Architecture:** React/Vite browser application, managed Supabase Auth/Postgres and one authenticated Supabase Edge Function. Original notes and replies persist before inference; the bounded assistant enriches the same entry. Keep storage authoritative and model output validated.

**Tech stack:** TypeScript, React, Vite, Tailwind/shadcn primitives, Supabase JS/Auth/Postgres/Edge Functions, Deno, Zod, OpenAI Agents SDK/OpenAI client, Node 24/npm, Vitest, Playwright, separate GitHub repository and Vercel project. Use the needed subset of the verified Travel dependency pins; no Next.js, Vinext, extra API server or Travel integrations.

**User decisions already made:**
- Small assessment project, separate from Travel; same underlying stack.
- Email/password authentication with private entries and persisted account chats.
- Meals and strength/cardio; text and tap-to-record voice with editable transcript.
- Save immediately; follow-ups optional and answered by short typed/spoken replies.
- Review fields, copy/paste only, explicit logged/undo; no file downloads.
- No nutrition estimates, coaching, photos, fitness integrations, dashboards or settings.
- Planning only until asked to implement; no paid API approval currently recorded.

Scope source: `docs/superpowers/specs/2026-10-22-fitness-capture-design.md`. Historical preview checklists do not add requirements. Work in this project's separate folder only. Never modify Travel, reuse its secrets, or apply its provider/confirmation exceptions automatically.

## Build sequence and checkpoints

Tasks 1–4 produce the assessment's private text workflow. Task 5 supplies the chosen AI behavior, Task 6 adds thin voice support, Task 7 verifies delivery. Finish and inspect one task before starting the next; no parallel implementation is necessary. Keep commits local until source/deployment authorization and setup are established.

There is no coverage quota, CI/deployment automation project, custom billing service, multi-agent framework, worker queue, general chat product, or production account-management project. The brief accepts incomplete work. If effort expands, preserve the usable core and document limitations rather than adding infrastructure.

## Shared contracts and storage decisions

Use Zod-inferred TypeScript types in `supabase/functions/_shared/domain/contracts.ts`, imported by the browser through a Vite `@domain` alias. Represent explicit quantities as strings to preserve ranges, units and approximate wording. Missing values are empty strings; do not turn unknown into zero.

```ts
// Public contract sketch: implement schemas first and infer these types from them.
type EntryKind = 'meal' | 'workout';
type Detail =
  | { type: 'food'; name: string; amount: string }
  | { type: 'strength'; exercise: string; sets: string; reps: string; weight: string }
  | { type: 'cardio'; activity: string; duration: string; distance: string };
type Question = { itemIndex: number; field: string; text: string };
type Entry = {
  id: string; kind: EntryKind; originalNote: string; note: string;
  details: Detail[]; pendingQuestion: Question | null;
  analysisStatus: 'idle' | 'processing' | 'ready' | 'failed';
  logged: boolean; version: number; createdAt: string; updatedAt: string;
};
type Message = {
  id: string; entryId: string; role: 'user' | 'assistant';
  content: string; sequence: number; createdAt: string;
};
type AnalysisRequest = { entryId: string; requestId: string; expectedVersion: number };
type AnalysisResult = { details: Detail[]; question: Question | null; reply: string };
```

Database rows use snake_case; one mapping layer produces the browser contracts. Two tables are sufficient:

- `entries`: UUID primary key, owner UUID tied to Auth, kind, immutable original note, current note, JSONB details and pending question, analysis state/request identity, logged boolean, integer version, timestamps.
- `messages`: UUID primary key, parent entry, role, text, per-entry sequence and timestamp; unique `(entry_id, sequence)` for stable order. Initial capture ID and submitted message IDs remain stable across retries.

Create the entry and first user message atomically. Append a user clarification and advance the entry version atomically. Apply a validated AI result and its assistant message atomically only when owner, expected version and analysis request match. Use small `SECURITY INVOKER` database functions for those transactions, with RLS active. Generate migration filenames through the Supabase CLI at implementation time; do not invent timestamps now.

RLS: no anonymous access; entry SELECT/INSERT/UPDATE restricted to verified owner, including `WITH CHECK` on writes; message access restricted through the owned parent entry. Do not trust a client-supplied owner ID or an unverified session cookie. Do not expose service-role keys. Index inbox access by owner/update time and messages by parent/sequence. No delete/history-pagination feature is necessary for this scope.

Client storage operations: list entries, load entry/messages, atomically create capture, append reply, save edited fields/note, set logged explicitly. One Edge endpoint handles analysis; it loads the saved content itself instead of trusting caller-supplied chat history or user IDs.

## Task 1: Establish the matching small project foundation

**Goal:** A React/Vite assessment shell builds in the existing separate fitness folder, with the old Sites preview preserved as history.

**Files:** Modify `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`; create `.nvmrc`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `vitest.config.ts`, `playwright.config.ts`, `supabase/functions/fitness/deno.json`; retain planning docs.

**Acceptance Criteria:**
- [ ] App uses React/Vite, TypeScript and Node 24; production output is `dist`.
- [ ] No Sites/Vinext/Cloudflare runtime dependencies remain in the assessment build.
- [ ] No Travel configuration, source providers, data catalogs or keys are copied.

**Steps:**
- [ ] Preserve the current local source in Git before conversion; port only useful product UI, export logic and voice behavior.
- [ ] Pin the required Travel-compatible dependency subset: React/DOM `19.3.1`, Vite `8.3.5`, TypeScript `7.0.2`, Supabase JS `2.118.0`, Zod `4.6.7`, Tailwind/Vite plugin `4.3.3`, React Vite plugin `6.1.2`, Vitest `5.0.5`, Playwright `1.64.1`; add the OpenAI dependencies in Task 5. Include only used UI primitives.
- [ ] Set scripts: `dev` = `vite --host 127.0.0.1`; `typecheck` = `tsc --noEmit`; `build` = `npm run typecheck && vite build`; `test` = `vitest run`; `test:e2e` = `playwright test`. Set Vite aliases `@` to `src` and `@domain` to the shared domain directory.
- [ ] Render a small Fitness Capture shell. Move useful preview files before removing obsolete local `app/`, `worker/`, SQLite/Drizzle and Sites-specific build files. Do not alter the already-deployed preview or any remote resource.
- [ ] Verify, then make a focused local commit.

**Verify:** `npm run typecheck` and `npm run build` exit 0; `npm run dev` serves the shell on loopback. No fabricated feature/test claims from the shell alone.

## Task 2: Implement private accounts and persisted entries/messages

**Goal:** Two synthetic users can independently sign in and persist private captures/conversations.

**Files:** Create `src/lib/supabase.ts`, `src/features/auth/AuthProvider.tsx`, `src/features/auth/AuthScreen.tsx`, `src/features/entries/repository.ts`, `supabase/functions/_shared/domain/contracts.ts`, a CLI-generated migration in `supabase/migrations/`, `tests/integration/accounts.test.ts`, `.env.example`; modify `src/App.tsx`.

**Acceptance Criteria:**
- [ ] Email/password sign-in/out works; session restoration does not expose another user's state.
- [ ] Original note and initial chat message commit together and survive reload/sign-in.
- [ ] Another user and anonymous clients cannot read/update entries or read/append messages.
- [ ] Duplicate capture/message IDs do not create duplicates; stale writes are rejected.

**Steps:**
- [ ] Write the ownership/persistence integration tests first using two synthetic accounts. Assert anonymous rejection; Bob cannot select Alice's entry/messages, change owner, or append to Alice's chat; reopening as Alice returns ordered history.
- [ ] Implement the two tables, constraints, owner RLS and small atomic transaction functions described above. Run database advisors; inspect policies and privilege grants. Avoid privileged database functions to sidestep RLS.
- [ ] Implement the browser Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; expose no server key. Build compact sign-in/out state handling and repository methods returning validated contracts.
- [ ] Use the local Supabase CLI/Docker environment for isolated integration tests where available. If unavailable, report the exact blocker; never redirect tests to Travel's project. A newly authorized fitness-only test project is the alternative.
- [ ] For assessment access, use a tested signup path or separately provisioned synthetic evaluator account. Do not add SMTP/reset-password work unless needed for that selected path. No confirmation policy change happens implicitly.
- [ ] Run tests, then commit the private data slice.

**Verify:** `npm run test -- tests/integration/accounts.test.ts` passes with configured fitness test resources; local browser sign-in → capture → reload → sign-out/sign-in restores only that user's data. Database setup must be explicitly approved before creating hosted resources.

## Task 3: Deliver immediate capture and resumable chat

**Goal:** Text captures and clarification replies are safely stored before AI processing, visible in one inbox and resumable later.

**Files:** Create `src/features/capture/CaptureForm.tsx`, `src/features/entries/Inbox.tsx`, `src/features/entries/Conversation.tsx`, `src/features/entries/useEntries.ts`, `tests/capture.test.ts`; modify `src/App.tsx` and the repository.

**Acceptance Criteria:**
- [ ] Meal/Workout notes save without requiring quantities or AI.
- [ ] Saved feedback follows confirmed storage; errors retain drafts.
- [ ] Selecting an entry loads its ordered persisted chat; sign-in/reload resumes it.
- [ ] A submitted clarification is stored on that entry, with no duplicate entry/message on retry.

**Steps:**
- [ ] Write failing state tests: rejected save keeps the draft; success clears the exact submitted draft only; lost-response retry keeps the capture/message ID; messages from a previously selected account/entry never leak into another selection.
- [ ] Build the Meal/Workout switch, note field, Save action, inbox and entry-scoped message list/composer. Preserve input on failure and show Saving/Saved/error feedback.
- [ ] Keep one stable client UUID for a pending capture/message across network retries. Repository operations return the already-saved result for the same identifier rather than inserting again.
- [ ] Store raw user replies immediately. Until Task 5 exists, label analysis unavailable and leave manual review usable; do not fabricate assistant/model responses.
- [ ] Implement Skip/Later as persisted question dismissal/defer behavior on the selected entry, without deleting its conversation. No separate history screen, chat titles, search or deletion feature.
- [ ] Verify, then commit capture/chat behavior.

**Verify:** `npm run test -- tests/capture.test.ts` passes; a synthetic note with missing amounts saves, survives refresh and retains its same ID/conversation.

## Task 4: Add structured editing, copy and explicit logged state

**Goal:** A usable text-only product supports review, corrections and transfer to the user's real tracking app.

**Files:** Create `src/features/entries/EntryReview.tsx`, `supabase/functions/_shared/domain/entries.ts`, `tests/entries.test.ts`, `tests/review.test.ts`; modify the inbox/repository.

**Acceptance Criteria:**
- [ ] Foods have name/amount; strength has exercise/sets/reps/weight; cardio has activity/duration/distance.
- [ ] The original capture remains available after edits; corrections update the same entry.
- [ ] Copy uses saved current details and never changes logged status; clipboard failure shows selectable text.
- [ ] Unsaved edits block copying/logging until save/discard; explicit log/undo persists.

**Steps:**
- [ ] Write domain tests for missing amounts, approximate text, strength/cardio values, immutable original note, export formatting and stale updates. For example:

```ts
it('copies only recorded quantities', () => {
  const result = formatEntry({
    kind: 'meal', note: 'two eggs and some rice',
    details: [
      { type: 'food', name: 'eggs', amount: '2' },
      { type: 'food', name: 'rice', amount: '' },
    ],
  });
  expect(result).toContain('eggs: 2');
  expect(result).toContain('rice: amount not recorded');
  expect(result).not.toMatch(/calories|protein|estimated grams/i);
});
```

- [ ] Implement pure `formatEntry({kind,note,details}): string` and a validated version-checked entry update. Render compact manual detail fields; keep names/units textual rather than introducing exercise/food catalogs.
- [ ] Add Copy text with selectable-text fallback, original-note disclosure, Save/Discard detail actions and Mark logged/Move back actions. A note edit warns that re-extraction will replace structured values; AI results may never overwrite a newer user edit.
- [ ] Inbox filters show To log/Logged. Chat remains attached in both states. Add no file-download code.
- [ ] Verify, then commit the complete private text workflow.

**Verify:** `npm run test -- tests/entries.test.ts tests/review.test.ts` passes. Browser copy → same To log state; explicit logged action → Logged filter; undo → To log. This is the first complete assessment core.

## Task 5: Add one authenticated AI extraction/clarification workflow

**Goal:** A bounded assistant understands saved notes and optional replies while keeping durable user data authoritative.

**Files:** Create `supabase/functions/fitness/index.ts`, `supabase/functions/_shared/server/auth.ts`, `handler.ts`, `fitness-agent.ts`, `src/lib/fitness-api.ts`, `tests/analysis.test.ts`; extend shared schemas, repository transactions and conversation UI.

**Acceptance Criteria:**
- [ ] Missing/invalid user tokens receive 401 before any model call; another user's entry receives no analysis.
- [ ] A saved note produces a validated breakdown and at most one focused optional question per response.
- [ ] A natural-language clarification updates the same entry and persists the assistant response.
- [ ] Refusal/timeout/malformed results keep saved content; explicit retry avoids duplicate displayed messages.
- [ ] Late results cannot overwrite newer versions; no nutrition/coaching/ownership/logged output is accepted.

**Steps:**
- [ ] Write fake-provider tests first: `two eggs and some rice`, `a chicken sandwich`, mixed squat/run note, `about half a cup`, `I didn't track it`, unrelated input, refusal, timeout, invalid schema, duplicate request, cross-user target and user edit during inference.
- [ ] Implement the authenticated handler with an injected assistant adapter. Request body is only `AnalysisRequest`; retrieve note/current fields and bounded recent messages from the caller-owned entry. Enforce input limits, CORS for the new frontend origin, and version/request matching.
- [ ] Pin `@openai/agents` `0.20.0` and `openai` `7.39.0`, matching the inspected Travel stack. Configure one `Agent` and bounded `Runner` request with structured Zod output, no tools/handoffs, disabled tracing/response storage and automatic provider retries. Verify current SDK APIs before coding; do not copy Travel's tools or provider registry.
- [ ] Prompt only for stated foods/servings/workout facts and a useful optional missing-field question. Keep compound dishes intact, unknowns empty, and approximate answers approximate. Schema bounds: at most 30 items, 4,000-character user messages and a small reply/question. No recipe decomposition or numerical nutrition.
- [ ] Claim each analysis request on the entry before provider work. The same in-progress/completed request does not initiate another model call. Explicit retry after failure uses a new request ID. Bound in-flight time and permit recovery from an abandoned processing state. Apply final details/question plus assistant message in one ownership/version-checked transaction; stale output is discarded with an actionable reload message.
- [ ] Display pending/failure/retry states without blocking new capture, manual correction or copying saved values. A direct field edit does not call AI. Persist the assistant message before displaying it as completed.
- [ ] Keep model use disabled until explicit spending approval and secure separate-key setup. Use the approved OpenAI key workflow, then store `OPENAI_API_KEY` only in the new Edge Function's secrets. Select/verify the model and input/output/call limits during that setup. Run a small counted synthetic live test batch only within the authorized budget; no custom billing subsystem or public unlimited-inference promise.
- [ ] Verify fake-provider tests and a separately labeled authorized live test, then commit.

**Verify:** `npm run test -- tests/analysis.test.ts` passes; `deno check --config supabase/functions/fitness/deno.json supabase/functions/fitness/index.ts` exits 0. Synthetic live evidence, when authorized, must show saved initial note → actual assistant question → saved reply → updated same entry/chat.

## Task 6: Add thin browser voice capture and reply support

**Goal:** Voice is an alternate input to the exact same persisted capture/reply paths.

**Files:** Create `src/lib/voice.ts`, `src/features/capture/useVoice.ts`, `tests/voice.test.ts`; modify capture and conversation composer components.

**Acceptance Criteria:**
- [ ] Record → Stop → editable transcript works for a capture and a clarification.
- [ ] Existing draft text survives denial/no-speech/start/network failure; retry creates a fresh speech session.
- [ ] Interim snapshots do not duplicate words; unmount/sign-out stops recording.
- [ ] No raw audio is stored; browser/provider processing is disclosed before recording.

**Steps:**
- [ ] Port the useful pure preview speech lifecycle and write/retain failing behavior tests with an injected speech-session factory.
- [ ] Integrate one shared hook into both text composers. Preserve the pre-recording draft; replace transcript snapshots rather than appending duplicates. Stop before submission and require the same explicit Save/Send action as typed input.
- [ ] Set a modest recording timeout, clean up on navigation/unmount, and label Recording/Stop clearly. If unsupported, disable voice and keep text available; no paid transcription fallback.
- [ ] Verify, then commit voice support. Actual hardware/provider compatibility is documented independently of simulated unit tests.

**Verify:** `npm run test -- tests/voice.test.ts` passes; synthetic speech is editable before submission in a supported browser, with typed fallback available. Do not record real personal audio during initial QA.

## Task 7: Verify and deliver the small assessment product

**Goal:** An evaluator can open the new deployed app, use private persisted chats, and inspect/run the source.

**Files:** Create/modify `vercel.json`, `.env.example`, `README.md`, `docs/VALIDATION.md`, `tests/e2e/fitness.spec.ts`; keep the local run commands accurate. No deployment automation project is required.

**Acceptance Criteria:**
- [ ] New Vercel frontend and new Supabase backend/schema are the verified deployed revisions.
- [ ] Fresh evaluator login works; two users remain isolated; entry/chat survive new sessions.
- [ ] A meal and mixed strength/cardio example exercise clarification/edit/copy/log/undo; AI/voice failure preserves data.
- [ ] Source access and concise works/incomplete/how-to-run notes are available; no credentials/secrets are committed.

**Steps:**
- [ ] Add a small Playwright walkthrough using synthetic accounts/data: sign in, capture, reopen conversation, optional reply, edit, copy/log distinction, logged undo, sign out. Test a mobile viewport and keyboard labels/focus. Avoid testing every small UI detail.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, and the Deno check from Task 5. Review failures; do not substitute fixture results for live provider/auth evidence.
- [ ] Establish explicitly authorized new fitness-only resources: GitHub repo, Vercel Vite frontend (`dist`) and Supabase Auth/Postgres/fitness Edge deployment. Apply the migration, configure exact allowed frontend origins and public browser variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_FITNESS_API_URL`). No secrets in browser variables. Do not use Sites publication for this assessment stack.
- [ ] Configure evaluator login through a tested signup path or separate test account; do not silently disable verification, configure SMTP or send invitations. Ask only for the specific missing setup/permission if necessary. Share credentials securely, outside source/README.
- [ ] Verify both live frontend and backend with a fresh user session. Confirm protected Edge requests fail anonymously and another account cannot access entry/chat IDs. Capture actual microphone verification only if performed with synthetic speech.
- [ ] Write README sections: purpose, stack, exact local commands/environment key names, works/incomplete, deployment/source links, and a short code/data-flow walkthrough. List any incomplete chosen feature honestly. Do not claim author code review or two-hour compliance that did not occur.
- [ ] Record test/build results and exact deployed source revisions in `docs/VALIDATION.md`. Leave the unrelated Travel deployment and the historical private Sites preview unchanged. No assessment submission or external messaging.

**Verify:** All appropriate commands exit 0; live app and source links work for the intended evaluator; a new session restores the user's saved conversation. Any pending login, unavailable backend tooling, provider approval or sharing limitation is reported as a blocker, not completion.

## Definition of done and final execution boundary

The minimum assessment core is authentication + private persistent text entries/chats + edit/copy/log + accessible app/source/run notes. The chosen product scope also includes bounded AI and browser voice; if either is incomplete, say so explicitly. Keep all excluded features out.

This plan is ready for review. Every task is pending. Do not execute it until the user asks to start; do not interpret a request to review or refine the plan as that instruction.
