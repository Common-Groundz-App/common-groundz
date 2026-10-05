# Step 3A — review composer foundation (verification)

Date: 2026-10-05. Scope: unused foundation only. No routes, pages, switch, entry-point, database or legacy-form changes.

## Delivered (`src/components/review-composer/`)

| Piece | File | Contract |
|---|---|---|
| Modes | `modes.ts` | 4 modes, `MODES satisfies Record<ComposerMode, ComposerCapabilities>`; unsupported combos throw |
| Values | `values.ts` | typed `ReviewComposerValues` / `SectionValueMap`; no `unknown` section state |
| Sections | `sections/index.ts` | hydrate / validate / availability only; no serialize |
| Availability | `sections`, `stepEngine.ts` | `enabled`, `mode-disabled`, `subject-incompatible`, `not-rendered` |
| Store | `store.ts` | session-keyed reducer; stale actions dropped; `SUBJECT_CHANGED` resets session answers; controller owns create nonce |
| Save builders | `saveBuilders.ts` | only serializers; named-field allowlists; reuse identity, category, metadata-merge and recommendation helpers |
| Step engine | `stepEngine.ts` | validates enabled sections; returns first invalid section id |
| Upload session (F7) | `uploadSession.ts`, `useUploadSession.ts` | id stable per session key; cleanup only for open sessions; never on key change, saving, ambiguous or committed |
| Server results | `serverErrors.ts` | typed results; uses existing `isOwnReviewUniqueViolation` / `isEditWindowClosedError`; no new message parsing |
| Ambiguity | `reconcile.ts` | evidence (`strong` / `compare` / `weak`), never a verdict; manual retry only after explicit user choice |

## Evidence

- New tests: `composerFoundation.test.ts` (57) + `composerHooks.test.tsx` (4): all pass.
- Full suite: 68 files, 960 passed, 3 skipped. Typecheck clean.
- Boundary tests: no file outside the module imports it; the module contains no error-text matching.
- Legacy forms (`ReviewForm.tsx`, `steps/*`, `ReviewTimelineViewer.tsx`) unchanged in 3A.
- Design doc rewritten in place to the post-3.0A contract (status, field matrix, save mappings, routes, server rules, parity checklist).

## Known limits (unchanged, separate work)

- Timeline creation can't be conclusively reconciled without a server submission key.
- Review Edit's closed-window detection still uses the one existing helper until the server returns a typed result.
- DOM focus on the first invalid field happens in 3B, when a screen exists.
