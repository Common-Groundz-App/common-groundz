# Phase 2 verification + AutoFillPreviewModal overflow fix (revised)

## 1. Did Phase 2 work as intended on the Chanel URL?

Yes. The edge logs for request `e17c85e4-25fa-40aa-879c-ac091da831cf` show the V2 pipeline failed along the exact path Phase 2 was designed to catch, and the UI rendered the metadata-only fallback.

What happened:
- Direct fetch: `FETCH_BAD_STATUS` (403 from Chanel).
- Firecrawl recovery: `FIRECRAWL_HTTP_ERROR` 408 (timed out after ~26s).
- Primary Gemini: `GEMINI_BAD_RESPONSE` (no text parts, JSON parse failed).
- Search-only Gemini fallback: skipped, `skip_reason: budget_exhausted` (Firecrawl consumed the time budget).
- Final V2 response: `predictions_value_source: "none"`, `chosen_source_reason: "all_null"`.

So `predictions.predictions` was null → modal entered the no-predictions branch.

In parallel, `fetch-url-metadata-lite` succeeded and returned usable basic data:
- Title: `allure homme sport eau de toilette spray` (extracted/sanitized from URL path).
- Website URL.
- 5 images from Google image search.
- Favicon found.

`buildMetadataOnly` accepted it (title + ≥1 valid image), so the modal showed:
- "AI details unavailable" header.
- Metadata preview card with title, website URL, image thumbnails.
- "Use basic metadata" button.

No confidence %, no type/category/brand/price/tags/description shown. Successful AI path untouched. This matches the Phase 2 v4 spec.

**Verdict: working as intended.** The one non-Phase-2 observation is that Firecrawl burned the budget and starved the search-only Gemini fallback, which is a future V2 tuning concern, not this fix.

## 2. UI fix — metadata-only modal overflow

Problem visible in the screenshot: the metadata preview card and long website URL push past the dialog's right edge. The root cause is in `src/components/admin/AutoFillPreviewModal.tsx`, no-predictions branch only (lines 257–329):

- `DialogContent` is `max-w-md` with no width cap against the viewport and no `overflow-x-hidden`, so nested content can expand the dialog.
- The URL `truncate` doesn't work because its parent has no `min-w-0`.
- Fixed `grid-cols-4` with `h-16 w-full` tiles overflows narrow phones.
- Footer buttons can get cramped on small screens.

### Approved changes (strictly scoped)

Only update the no-predictions / metadata-only branch of `AutoFillPreviewModal.tsx`.

1. **DialogContent**:
   `w-[calc(100vw-2rem)] max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden`
   - `100vw` ensures viewport-safe width, not parent-relative `100%`.
   - 1rem side gutters on mobile.
   - A bit more breathing room on `sm`+.
   - Vertical scroll for tall content; horizontal overflow clipped.

2. **Metadata preview container**: add `min-w-0 overflow-hidden max-w-full` so children can shrink inside flex/grid contexts.

3. **Website URL block**: wrap the `<p>` parent with `min-w-0`, keep `truncate` on the text, and add `title={metadataOnly!.websiteUrl}` so desktop users can hover to see the full URL.

4. **Image grid**: change `grid-cols-4` to `grid-cols-2 sm:grid-cols-4`, and change tile class from `h-16 w-full` to `aspect-square w-full` for consistent scaling. Still show max 4 images.

5. **DialogFooter**: add `flex-col sm:flex-row` (the base `DialogFooter` already does `flex-col-reverse sm:flex-row`, but an explicit prop on the component call clarifies intent and works if overrides are needed).

6. **Scroll padding safety**: rely on the existing `DialogContent` padding; no additional sticky footer needed.

### Out of scope (do not touch)

- Successful-prediction branch of `AutoFillPreviewModal.tsx`.
- `applyPredictionsToForm`, `applyMetadataOnlySafe`, `buildMetadataOnly`, `pickValidImages`, `resetAutofillOwnedFields`, `normalizeUrlForCompare`.
- `CreateEntityDialog.tsx` state logic (`lastAnalyzedUrl`, `metadataUrl`).
- All edge functions, V1, DB, Gemini, Firecrawl, Zod, merge rules, confidence display.

### Verification after build

- Open the metadata-only dialog for the Chanel URL.
- Desktop: no horizontal overflow, URL truncates with ellipsis, images 1×4.
- Mobile (375px): no horizontal overflow, images 2×2, URL truncates, footer buttons stack.
- Successful AI prediction modal remains visually unchanged.
