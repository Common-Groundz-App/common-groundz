# Review composer foundation

Introduced in Step 3A. Not mounted by any screen until the page integration
(3B). The legacy review popup and inline timeline form stay independent during
rollout and are not imported here.

- `modes.ts` — four modes, exhaustive capability rows and steps.
- `values.ts` — typed value model (one key per section).
- `sections/` — per-section hydrate / validate / availability. No save logic.
- `saveBuilders.ts` — the only payload serializers (runtime allowlists).
- `store.ts` — session-keyed reducer + controller; stale actions are dropped.
- `stepEngine.ts` — step validation; returns the first invalid section.
- `uploadSession.ts` / `useUploadSession.ts` — stable upload session (F7).
- `serverErrors.ts` — typed server results; no message parsing.
- `reconcile.ts` — evidence after an ambiguous save, never a verdict.
