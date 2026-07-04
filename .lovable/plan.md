## Problem

Duplicate detection currently runs **only at final "Create Entity" submit**. Re-analyzing an already-indexed URL (e.g. the maccaron Medicube pore-pad URL) forces the admin through Analyze → Brand step → Image step → full form, then fails with "Duplicate Website URL". All the work — and the AI/scrape credits — are wasted.

## Solution: exact-URL preflight before Analyze

Run a **URL-only** duplicate check the instant the admin clicks Analyze, **before** invoking `analyze-entity-url` / `analyze-entity-url-v2`. If the URL exactly matches an existing entity's `website_url` or `metadata.created_from_url` (after normalization), block the pipeline and show a dedicated dialog. Fuzzy name/slug matching stays exactly where it is today (final submit), unchanged.

## Edge function change — `supabase/functions/check-entity-duplicates/index.ts`

Add a new `mode` field to the request body. When `mode === 'exact_url_preflight'`:

- Skip auth-preserving behavior? No — keep the existing admin gate and rate limit as-is.
- Skip **everything** except:
  - **Rule A** — `entities.website_url` normalized-full-URL equality (current Step 4 logic).
  - **Rule B** — `metadata->>'created_from_url'` normalized-full-URL equality (current Step 5 logic).
- Skip: name similarity (Step 1), slug (Step 2), slug history (Step 3), api_ref (Step 6), parent-boost. **Do NOT** reintroduce same-host / same-path-prefix heuristics.
- `name` and `type` become **optional** in this mode; the function no longer early-returns when they're missing.
- Response shape unchanged: `{ candidates: [...] }`. Each hit's `reasons` will be `["Same website"]` or `["Created from same source URL"]`.

Default mode (no `mode` field, or `mode === 'full'`) — behavior is **identical to today**. This is a purely additive change.

## Frontend change — `src/components/admin/CreateEntityDialog.tsx`

At the top of the Analyze click handler (~line 1026, right before `fnName = analyzeEngine === 'v2' ? …`):

1. Disable the Analyze button and show its existing loading state.
2. Call `check-entity-duplicates` with `{ mode: 'exact_url_preflight', sourceUrl: url, websiteUrl: url }`, wrapped in a 2s timeout.
3. Branches:
   - **Hit** → stash the URL in a new `pendingAnalyzeUrl` state, set a new `exactUrlDupCandidates` state, open the new `ExactUrlDuplicateDialog` (below), and `return` before invoking analyze. **No AI/scrape credits are spent.**
   - **Miss** → proceed with normal Analyze flow.
   - **Preflight error / timeout** → log a `console.warn`, do **not** block, fall through to normal Analyze. Final-submit duplicate check remains the safety net.

Add a one-shot bypass flag `skipEarlyDupCheckOnce`. "Continue Anyway" sets it, re-triggers Analyze for the same URL, and the flag is cleared immediately after that single Analyze call starts. A subsequent Analyze click for the same URL runs the preflight again.

## New component — `src/components/admin/entity-create/ExactUrlDuplicateDialog.tsx`

Small variant of `DuplicateConfirmDialog` with stronger copy — the existing dialog stays untouched and continues to serve the final-submit fuzzy case.

- **Title**: "This URL already exists"
- **Body**: "We found an entity created from the same URL."
- Shows the matched entity card (image, name, type, parent) — reuse the row layout from `DuplicateConfirmDialog`.
- Actions:
  - **Open Existing** — navigate to the existing entity page (same handler as `onUseExisting`).
  - **Continue Anyway** — sets `skipEarlyDupCheckOnce = true`, re-invokes Analyze once.
  - **Cancel** — closes dialog, clears `pendingAnalyzeUrl`, does nothing else.

## Explicitly NOT changed

- Fuzzy name/slug/api_ref/parent-boost paths in `check-entity-duplicates` — untouched.
- Final-submit duplicate check in `CreateEntityDialog` (~line 1806) — untouched; stays as safety net.
- `analyze-entity-url` / `analyze-entity-url-v2` edge functions.
- `brand_logo_lookup`, `entity_draft`, `BrandPicker`, `DraftReviewBody`, `EntityHeader`, migrations, RLS, other entity cards, explore dropdown.
- Existing `DuplicateConfirmDialog` component and its callers.

## Validation

1. Re-analyze the maccaron Medicube URL → **ExactUrlDuplicateDialog** appears before any Analyze spinner or brand step; Medicube entity is listed; no AI/scrape credits consumed.
2. Same URL with `?utm_source=x`, `#frag`, or trailing `/` → still matches (normalization already handles this).
3. A different maccaron product URL (e.g. Axis-Y) → preflight passes, Analyze runs normally, no dialog.
4. Preflight simulated failure (block the function in devtools) → warning logged, Analyze proceeds normally, final-submit check still catches the dupe later.
5. "Continue Anyway" → Analyze runs once. Cancel that flow, click Analyze again on the same URL → preflight fires again (one-shot bypass, not persistent).
6. "Open Existing" → navigates to the existing entity page, dialog closes.
7. Double-clicking Analyze while preflight in-flight → second click is ignored (button disabled).
8. Non-duplicate URL → visually identical to today's flow, ~150ms added round-trip.