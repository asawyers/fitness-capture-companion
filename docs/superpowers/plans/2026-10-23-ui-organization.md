# Fitness notebook UI organization

Approved scope: combine the two recommended brainstorms; preserve the existing small product, authentication, ownership, backend and copy-only workflow.

## Design

- Retain blue notebook identity, serif headings, plain readable input surfaces, stronger supporting-text contrast and visible keyboard focus.
- Compact header and three-line expanding capture form. Keep submitted-text processing notice visible; offer device dictation instructions without claiming to launch OS dictation.
- Desktop: capture above a left inbox list and right selected-entry review. Selection replaces the review pane.
- Mobile: Capture / Inbox navigation, entry review with Back to inbox. Keep drafts mounted, preserve list position, protect recording and unsaved review/reply work.
- Review: structured details, optional clarification, copy/log actions, then expandable working/original note and persisted conversation. Keep manual edits and copy/log distinction intact.
- No new backend, providers, paid calls, raw audio storage, downloads, profiles or dashboards.

## Parallel implementation

1. Layout agent: App, stylesheet and navigation tests.
2. Review agent: EntryReview and review interaction tests.
3. Capture agent: capture/voice components and dictation guidance tests.
4. Root: integrate, review specification and code quality, run tests/build, inspect responsive layout with synthetic content where tooling permits, publish only after validation to existing fitness source and main-account Vercel project.

## Acceptance checks

- Capture draft survives navigation; account switch still clears prior account draft.
- Mobile inbox/review transitions preserve selection and unsaved review data; navigation cannot hide an active recording.
- Food amounts and strength/cardio fields stay editable; unknown values remain explicit.
- Optional reply updates existing entry through unchanged APIs; saved conversation stays accessible.
- Clipboard copying never marks logged; manual copy fallback remains available.
- Dictation help focuses the correct field without clearing it or pretending to activate the OS microphone.
- No horizontal overflow at narrow widths; controls remain reachable and labeled.
- Existing auth/isolation/domain tests and TypeScript production build pass.
