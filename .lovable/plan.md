# Search-to-Draft Refinements (v3 — final)

Same five fixes as v2, with reviewer refinements folded in.

## Priority order (correctness first, polish last)
1. Stale URL-metadata leak into Search Step 2
2. Auto-expand form after Apply to Form
3. Remove "in database" chip
4. Top-3 page-metadata auto-enrichment for search rows
5. Enhance `ImageCandidateGrid` primary selection (prefer valid `page_metadata`, auto-shift on failure)

---

## 1. Stale URL-analysis images leaking into Search Step 2

**Root cause:** `src/components/admin/CreateEntityDialog.tsx` (~L3006–3021) unconditionally merges `pickValidImages(urlMetadata)` into `imageCandidates` and passes `urlMetadata={urlMetadata}` into `AutoFillPreviewModal`. After a prior URL analysis (WishCare), that state persists into the Search flow (Cetaphil) → bleed-through.

**Three-layer fix:**
1. In `handleSearchPick`, call `setUrlMetadata(null)` before opening the preview modal.
2. In the `entityDraft={(() => { ... })()}` IIFE, if `aiPredictions?.__fromSearch` → return `baseDraft` without the `pickValidImages(urlMetadata)` merge.
3. On `<AutoFillPreviewModal>`, pass `urlMetadata={aiPredictions?.__fromSearch ? null : urlMetadata}` so `DraftReviewBody` / `buildEntityFormPatchFromPredictions` also see it as absent for search-origin drafts.

URL Analysis path unchanged (still merges when `__fromSearch` is falsy).

## 2. Auto-expand form after "Apply to Form" (parity with URL Analysis)

**Root cause:** URL Analysis sets `setUrlAnalysisComplete(true) + setIsFormExpanded(true)` on success (~L1286). Search's `onPrefillForm` (~L3026) never does; non-admin users still see the collapsed "Or Enter Details Manually" button.

**Fix:** Inside the Search `onPrefillForm` callback in `CreateEntityDialog.tsx`, after prefill work and before the "Draft applied" toast:
```ts
if (variant === 'user') {
  setUrlAnalysisComplete(true);
  setIsFormExpanded(true);
}
```
Admin variant is already expanded. State name is awkward for search but it's the same collapse/expand switch — keep parity now, rename later if needed.

## 3. Remove "in database" chip

In `src/components/admin/entity-create/BrandPicker.tsx` (~L358–360), remove the `<Badge>… in database</Badge>`. The section header `EXISTING BRANDS (n)` already conveys it. Keep the `recommended` badge.

Not touching `"Matched in database ✓"` in `AutoFillPreviewModal.tsx` — also appears in URL Analysis. Deferred as a follow-up copy pass.

## 4. Top-3 page-metadata auto-enrichment for search rows

**Why top 3, client-side, in parallel, non-blocking:**
- Top 1 → inconsistent list. All 5 → 5× fan-out, tail-latency dominated by the slowest, burns the `enrich-candidate-image` 60/hr quota, and rows 4–5 are rarely picked. Top 3 covers the visible fold with bounded parallelism.
- Client-side reuses the exact `enrich-candidate-image` edge function used by the click-time path (shared cache/SSRF/rate limit) and lets the search response render instantly with per-row placeholders.

Implementation in `src/components/admin/entity-create/SearchEntryPanel.tsx`:

- **Trigger condition (Codex):** enrich when the candidate has a `sourceUrl` AND does **not already have a `page_metadata`-sourced image**. This intentionally *also* covers rows whose only image is a poor `google_grounding` one (matches your screenshot).
- **On success:** call `mergeEnrichedImage(draft, imageUrl, method)` — already idempotent (dedupes by URL in `applyEntityDraft.ts`), so retries are safe. Patch the row's visible display image AND the candidate's `draft.imageCandidates` (so Step 2 sees the same image).
- **On null/timeout/blocked:** keep existing image (Google or empty), no toast.

**Safeguards (ChatGPT + Codex):**
- `runIdRef` bumped on each new search.
- In-flight map keyed by **`${runId}:${idx}:${candidate.sourceUrl}`** (Codex — index alone can collide when a new search reuses idx 0–2 with different candidates).
- Map entry deleted in a `.finally()` after each promise settles so a failed row can be re-enriched on click.
- If Review & create is clicked on a row whose auto-enrichment is still in-flight, await the existing promise instead of firing a duplicate.
- On unmount / new search, `runIdRef` guard drops stale responses.

**Loading UI (Codex — non-destructive):**
- Row with no image → skeleton in the image slot until enrichment settles.
- Row that already has a `google_grounding` image → keep the current image visible, overlay a subtle shimmer/spinner. Swap only on success. Avoids flicker.

**Click-time enrichment stays** as fallback for rows 4–5 and any row where auto-enrichment returned null. Its skip condition is updated to the same "already has `page_metadata`" rule so it doesn't skip Google-only rows.

## 5. Enhance `ImageCandidateGrid` primary selection

`ImageCandidateGrid.tsx` already tracks `brokenUrls`, disables failed tiles, and clears primary when it becomes broken. Two gaps remain:

- **Initial recommended index:** parent (`AutoFillPreviewModal` / `DraftReviewBody`) currently trusts `recommendedImageIndex` from the draft, which can point at a Google-grounding tile that hasn't tried to load yet. Change the recommended-index computation to prefer the first `page_metadata` (or `enriched`/`user_upload`) candidate over `google_grounding` when choosing the default primary. If no `page_metadata` exists yet, fall back to existing behavior.
- **Auto-shift on primary failure:** in `ImageCandidateGrid`, the effect at L102–120 clears a broken primary but doesn't pick a replacement. Extend it to select the next non-broken candidate — preferring `page_metadata`/`enriched`/`user_upload` sources, then falling back to any non-broken tile — instead of leaving primary null.

## Out of scope
- `search-entity-candidates` edge function (no server changes).
- `enrich-candidate-image` internals (SSRF/cache/rate limit unchanged).
- URL Analysis pipeline and brand enrichment.
- `AutoFillPreviewModal.tsx` "Matched in database ✓" copy (URL Analysis flow too).
- `mergeEnrichedImage` dedupe logic — already idempotent.
- Any styling beyond removing the chip.

## Verification
1. Search `cetaphil gentle cleanser` → top 3 rows: rows with no image show skeleton→real image; rows with a Google image keep it with a shimmer overlay and swap only if `page_metadata` returns.
2. Fire a second search (`loreal absolut repair shampoo`) while first is still enriching → no stale responses patch the wrong candidate (runId guard).
3. Review & create → Step 1 no `in database` chip; header still `EXISTING BRANDS (n)`.
4. URL-analyze WishCare, close, then Search Cetaphil → Step 2 shows only Cetaphil-related images.
5. Step 2 with a broken google_grounding tile → not preselected as primary; primary defaults to first valid `page_metadata`/enriched candidate. If a working primary later fails to load, primary auto-shifts to the next valid candidate.
6. Non-admin: click Apply to Form → form auto-expands without manual click.
7. Full URL Analysis flow (analyze → preview → apply) → identical to today.
