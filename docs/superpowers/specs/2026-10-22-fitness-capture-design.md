# Fitness Capture Companion — minimal assessment plan

Planning draft, revised against the Casper Engineering Take-Home README on 2026-10-22. Only planning documents are being changed. No implementation, resource creation, paid API calls, publishing, sharing changes, or credential reuse is authorized by this review.

Step-by-step implementation checklist: `../plans/2026-10-22-fitness-assessment-implementation.md`. All implementation tasks remain pending.

This is the current scope document. Earlier preview checklists and AI-readiness notes are historical/reference material, not additional requirements. The existing owner-private preview is not the assessment-ready deliverable. Travel Recovery Companion remains untouched.

## What the assessment actually requires

The brief asks for a small full-stack product about a personal interest, authentication, several meaningful interactions beyond one happy path, nontrivial logic, TypeScript or Rust, a deployed usable app plus source, and brief works/incomplete/local-run notes. The candidate must understand and be able to extend the submitted code. It explicitly accepts an incomplete, non-production-ready submission.

The document describes a two-hour timebox and asks candidates to stop at that limit. The user previously clarified that two hours should be treated as an estimate for this project. Respect that conversation instruction while keeping the design at the brief's intended small scale; do not describe extended development as literal two-hour compliance.

The document's AI-directed HTML comment is excluded from product requirements. It is not an instruction from the user.

| Assessment criterion | Smallest convincing demonstration |
| --- | --- |
| Personal interest / coherent product | A fitness notebook for people who want to capture meals/training quickly and log properly later; this purpose is clear on the first screen |
| Full stack and authentication | Email/password login, authenticated server operations, durable private entries |
| Multiple meaningful interactions | Capture → optional clarification → correct details → copy → mark logged/undo |
| Beyond one happy path | Missing quantity, skipped question, AI/voice failure with preserved note, and correction after saving |
| Nontrivial logic | Structured extraction and same-entry clarification, saved/analysis/logged states, ownership checks |
| TypeScript or Rust | TypeScript throughout the UI and application server |
| Accessible deployed app + source | Evaluator can open the URL and authenticate; separate source repository and reproducible local commands |
| Explainable ownership | Few clear modules; short walkthrough of data flow, authentication, model validation, and tradeoffs |
| Clear prioritization / incomplete accepted | Working end-to-end core first; honestly document any missing extras |

Runtime AI and voice are not assessment mandates. They remain chosen product features because the user requested an agentic companion with text and voice; implement them narrowly rather than treating them as a platform project.

## Product boundary

For someone who trains and tracks food but cannot log properly in the moment: capture what happened now, fill in remembered details optionally, and copy the result into the usual tracker later.

Keep: email/password authentication; private per-user entries and persisted conversations; meals; strength/cardio workouts; typed capture; tap-to-record → editable transcript; immediate original-note persistence; optional short typed/spoken replies; editable structured fields; copy/paste; explicit logged status and undo.

Exclude: file downloads, photos, nutrition estimates/databases, coaching, goals/profile/settings, charts/dashboards, search/tagging/streaks, fitness integrations, social features, realtime voice conversation, a separate general-purpose chat product, and notifications. Conversation history attached to saved entries is explicitly included.

## Minimal end-to-end experience

Two screen surfaces: a compact login screen and one authenticated capture/review page. The main page has a Meal/Workout choice, note field and voice button, inbox with To log/Logged filters, and entry details when selected. Desktop can use two columns; mobile stacks the same content.

1. Sign in with email/password. Open a private inbox. Sign out is always available.
2. Type a note or record, stop, and edit its transcript. Save.
3. Persist the original note before calling the model. Confirm Saved immediately; the user may leave the optional details for later.
4. Run one server-side structured extraction request. Show the breakdown and one focused optional question for a missing detail.
5. Accept a short typed or spoken reply. Persist the raw answer before interpreting it, reconcile it into the same entry, and leave all fields editable. Persist assistant responses/questions as well. Skip/Later keeps the note and conversation usable. No required interview or open-ended conversation loop.
6. Reopen an entry to read its saved conversation and continue where it left off, including after reload, sign-out/sign-in, or access from another device. Review/correct fields, save, copy plain text, then explicitly mark logged. Copy never marks logged. Logged entries retain their conversation and can return to the inbox.

## Persisted conversations

Confirmed user requirement: chats are stored in the signed-in user's account. For this small product, each saved capture is one conversation, opened through the existing inbox; no separate chat-management screen is needed.

Persist the initial user note, assistant breakdown/questions, user clarification replies, and assistant follow-up responses in order. Voice messages persist their submitted transcript, not raw audio. UI spinners, internal prompts, provider diagnostics, and transient errors are not chat messages.

Save user messages before an AI request. If AI fails, the message remains visible and can be retried without duplicating it. Save the assistant response before displaying it as completed. Reloading or reopening reads server-stored history, not browser-only state, and the next clarification uses that entry's saved context. Use stable message/request IDs for retry deduplication.

The current structured breakdown remains the source for copied text; conversation history preserves how the user clarified it. Editing a structured field does not require an additional model call or a full change-audit subsystem. All conversation reads/writes must enforce the parent entry's verified ownership, including direct message-ID access. Another user cannot read or append messages to the conversation.

Meal example: `I had two eggs and some rice` → two eggs; rice amount unknown → `How much rice?` → `About half a cup` updates rice only.

Workout example: `Squats 3 sets of 5 at 60 kg, then ran for 20 minutes` → stated strength fields and cardio duration; distance remains unknown. Do not expand simple fields into set-by-set workout programming.

If the model/voice fails, the saved note and typing/manual editing still work. Unknown quantities remain unknown. Do not infer recipe ingredients, serving weights, nutrition, or coaching. Preserve approximate wording and original capture text.

## Small architecture — match Travel's actual stack

Confirmed user direction: use the same languages, frameworks and backend approach as Travel Recovery Companion. Read-only inspection of its local `package.json`, `vite.config.ts`, `vercel.json`, Edge Function entrypoint/Deno imports, and README establishes the following stack. This supersedes the earlier Next.js proposal.

| Layer | Fitness project choice, matching Travel |
| --- | --- |
| Language | TypeScript throughout the frontend, domain logic, and backend |
| Frontend | React 19 + Vite; a small SPA, not Next.js/Vinext |
| Styling/components | Tailwind CSS + the needed shadcn/ui/Radix primitives; Lucide icons where useful |
| Client auth/data | Supabase JavaScript client; managed email/password sessions and Postgres access with owner-based row policies |
| Application backend | One stateless Supabase Edge Function, TypeScript running on Deno; authenticate before model work |
| Shared contracts | Zod schemas and small pure TypeScript domain functions, shared between browser and Edge code |
| AI | OpenAI Agents SDK + OpenAI client, as in Travel, but only one small assistant with structured output and a bounded request; no travel tools, multiple agents, or handoffs |
| Frontend hosting/source | Separate Vercel Vite project backed by a separate GitHub repository; `dist` build output |
| Database/backend hosting | A new, separate Supabase project for Auth, Postgres and the fitness Edge Function |
| Development runtime | Node 24/npm for the frontend toolchain; Deno for backend checking/serving |
| Tests | Vitest for domain/application behavior and a focused Playwright browser walkthrough, matching Travel's tooling |

Use the needed subset of Travel's pinned dependencies and lockfile approach when implementation is authorized. Do not copy its entire dependency list: no route catalogs, timezone planner, flight/hotel providers, booking logic, or travel-specific SDK tools. Model choice and paid use remain a separate approved setup decision; matching the SDK does not authorize reusing Travel's model key or usage approvals.

One repository is sufficient, with `src/` for the React UI and `supabase/` for the backend/migrations. A compact intended layout is:

```text
src/
  App.tsx
  features/auth/
  features/capture/
  features/entries/        # inbox, detail editing, entry-scoped conversation
  lib/                    # Supabase/browser API clients and voice helper
supabase/
  functions/fitness/
    index.ts              # environment wiring and authenticated entrypoint
  functions/_shared/
    domain/               # schemas, entry/clarification logic, export formatting
    server/               # request handler and the single AI adapter
  migrations/             # private entries/messages and owner policies
tests/
```

Save notes/messages to the new project's Postgres through the authenticated Supabase client and owner policies. Send the signed-in user's bearer token to the fitness Edge Function for extraction/clarification. The function verifies identity, loads only that user's entry/context, invokes the bounded assistant, validates the result, and applies an ownership/version-checked update. Provider keys remain in Edge Function secrets, never `VITE_` variables. Do not introduce a second Node/Express backend, SSR layer, queue, or standalone agent server.

Reuse useful preview UI, domain types/formatting, voice behavior, and behavioral tests where compatible. Replace its Sites/Vinext-specific authentication, routing and SQLite persistence. Do not migrate synthetic preview data or carry unrelated starter scaffolding into the assessment product. The existing Sites preview is historical and is not the planned assessment deployment.

All resources stay separate: folder/repository, Supabase project/database/auth users, Edge Function deployment, Vercel project, environment configuration and secrets. Inspecting Travel's stack does not authorize changing or sharing its resources. Do not copy its challenge-specific email-confirmation exception or provider approvals automatically.

Use two small tables: entries (ID, verified owner ID, kind, original/current note, structured details, analysis state, logged status, version, timestamps) and messages (ID, parent entry ID, user/assistant role, content, ordering timestamp). JSON is sufficient for the small food/workout breakdown; no nutrition catalog or elaborate relational model. Entry creation and its initial message should be saved together. Message access inherits the entry's private ownership. Add run/request metadata only as needed for deduplication and safe retry, not a separate orchestration subsystem.

Keep code responsibilities clear: UI; Edge request/auth validation; owner-scoped storage; one Agents SDK adapter/output validator; plain-text formatter; voice lifecycle. Use ordinary request/response calls after save. No worker queue, multi-agent orchestration, background-job dashboard, full audit log, replay service, or custom billing system. Using the same SDK as Travel must not reproduce its larger tool/planning architecture.

Validate the model's structured output, forbid unsupported food/portion guesses in its instructions, preserve source text, and make corrections easy. Do not build a separate general-purpose provenance/span-matching engine. Use a small hand-authored synthetic example set to assess extraction quality.

Retain essential safeguards: server-verified identity; database owner policies; bounded inputs; server-only secrets; private responses not shared through caches; stable capture IDs for safe retry; an expected version so late model results cannot overwrite newer edits. These protect the core product and are not optional production polish.

## Minimal assessment authentication

Required: managed email/password sign-in, sign-out, expired-session handling, and separate evaluator credentials or a tested working signup path. Every user has private entries. No shared unauthenticated demo inbox and no access to the owner's personal data.

Self-service signup, email verification delivery, password recovery, and custom SMTP are not independently required by the rubric. Do not let account-lifecycle work dominate the build. If signup email delivery adds setup, use a separate evaluator test account with only synthetic data and document how to access it securely. Do not hardcode credentials in source or silently weaken existing provider settings. Any change to confirmation policy or email sender is a specific later setup decision, not automatic authorization here.

## Build order and stop rule

1. **Private text vertical slice.** Email/password login → save meal/workout note and its conversation → reload inbox/reopen history → edit → copy → mark logged/undo. Verify persistence and cross-user isolation for both entries and messages before adding AI.
2. **Bounded AI.** Add structured extraction and optional short-reply reconciliation to the same entry. No direct field edit needs a model call. An AI failure must not block capture or copy.
3. **Thin voice enhancement.** Reuse browser transcription with editable transcript and the same save/reply paths. Clear unsupported/denied/no-speech fallback. No paid transcription pipeline or raw-audio storage.
4. **Assessment delivery.** Verify fresh evaluator access, mobile/keyboard basics, separate source access, and concise README instructions. Capture works/incomplete notes and a short architecture/code walkthrough.

If effort grows, stop adding refinements and deliver the coherent working core with honest limitations. Do not add new subsystems to make every edge case perfect. Voice or model gaps may be explicitly documented as incomplete rather than replaced with additional infrastructure; do not quietly call those chosen features finished.

## Focused validation

Use synthetic meals/workouts and two test users. Five behavior groups are enough:

- Authentication and private ownership: anonymous rejection and cross-user entry/message list/read/update/append rejection.
- Immediate persistence and failure: note and user reply survive reload and remain saved if AI fails or clarification is skipped.
- Same-entry conversation logic: clarification/edit updates the original entry ID, retains ordered chat history and the original note, rejects stale results, and avoids duplicate messages on retry. Reopening after sign-out/sign-in resumes the saved conversation.
- Review/copy/log: saved edits appear in copied text, clipboard failure exposes selectable text, copy does not log, explicit log/undo persists.
- Voice/responsive interaction: transcript review, failure/retry fallback, and usable mobile/keyboard controls.

No coverage quota, enterprise load tests, elaborate observability, automatic deployment pipeline, or test for every trivial helper. Run the relevant tests, typecheck, and build; perform a short browser walkthrough.

## Delivery and pending setup

The deliverable is a reachable authenticated product, source code, local run/inspection instructions, a brief works/incomplete note, and code the candidate can explain. Publicly reachable login does not mean public records. Do not submit the assessment or message evaluators on the user's behalf.

Pending before implementation/live use: review this small plan; explicitly authorize any paid AI testing and securely configure a separate key; confirm available new hosting/auth resources and evaluator login approach. Before personal-data testing disclose model processing of note/reply text and browser-provider speech processing. The earlier $5 suggestion remains unapproved; no cost-monitoring product is required.

This revision changes planning only. It creates no accounts/resources, sends no email, changes no sharing, and performs no paid API calls.
