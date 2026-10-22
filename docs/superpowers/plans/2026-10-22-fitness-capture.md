# Fitness Capture Companion implementation plan

Historical implementation record. The user reset the work to planning on 2026-10-22. The current working design is `../specs/2026-10-22-fitness-capture-design.md`; this older checklist is not authorization for additional implementation.

Goal: a deliberately small assessment project for capturing private meal/workout notes and manually logging them elsewhere.

Architecture: React client, TypeScript route handlers, D1/SQLite entry storage. Sites owns sign-in/session handling; every query is scoped to its verified user ID. No paid AI services or raw-audio storage. A conservative deterministic parser extracts explicit fields; unknown amounts stay blank. Local sign-in is the starter's loopback-only mock, excluded from production.

The supplied conversation already approves the design and implementation. Do not repeat product approval questions. Work only in this new directory and its new Sites project.

## Approved scope

Text and tap-to-record voice → editable transcript → immediate save → optional per-item clarification → review/edit/copy → explicitly mark logged. Strength and cardio are supported. No nutrition estimates, photos, coaching, dashboards, integrations, or settings.

## Implementation tasks

- [x] Domain logic (`lib/entries.ts`, `tests/entries.test.ts`): test explicit food amounts, ambiguous text preservation, strength/cardio fields, missing quantities, validated clarification and plain text export. Implement parser after failing tests. Preserve original note forever and keep updates on the same ID.
- [x] Private persistence (`db/schema.ts`, `lib/store.ts`, `lib/api.ts`, `app/api/entries/route.ts`, `app/api/entries/[id]/route.ts`, `tests/api.test.ts`): schema migration; prepared queries with owner predicates; request validation, same-origin writes, version conflicts, idempotent creation. Verify two synthetic users cannot read/update each other's entries; data survives SQLite reopen.
- [x] Capture/review UI (`app/page.tsx`, `app/capture-app.tsx`, `app/use-voice.ts`, `app/globals.css`): signed-out sign-in, capture kinds, draft-preserving errors, voice stop/retry/disclosure, optional clarification, original/current review, editing, inbox/logged filters, individual copy and explicit status changes. Verify keyboard and small-screen flows.
- [x] Delivery (`README.md`, `docs/VALIDATION.md`): typecheck, unit/integration tests, build, local browser verification using synthetic data; publish this separate owner-private Site via Sites source workflow and report literal verified URLs plus limits.

## UI direction

A compact field notebook: blue ink #183f65, paper #f4f7fa, white #fff, muted steel #536577, highlight #e4eef8, error #a92b37. System sans type for clear controls, a quiet serif title. One generous note field anchors the screen; a simple lined inbox sits beside it on desktop and below it on mobile. No charts, decorative hero, or profile surfaces. Label inputs; preserve visible focus; use live regions for saved/error/recording feedback.

## Verification and known boundaries

Run `npm test`, `npm run typecheck`, `npm run build`; test actual SQLite with synthetic users and rows. Browser QA covers signed-out access, local sign-in, meal and workout creation, optional questions, reload, edit, export/logged separation, mobile overflow, microphone failures and retry. Speech recognition is browser/vendor dependent and can transmit audio to the browser's provider: disclose before recording, no app-owned audio retention. Deterministic extraction is intentionally bounded; the note and manual editing are the fallback. Hosted auth and microphone hardware need honest separate evidence.

User update: file downloads removed. Plain-text copy/paste only; do not attempt download QA.

Delivery boundary: owner-private hosting successfully published; full hosted browser capture requires the user to complete OpenAI login. Local browser flows and synthetic cross-user isolation are verified.
