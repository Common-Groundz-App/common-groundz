
# Phase 2 — Metadata-Only Safety Net (V2 failure path), v4

Folds in both reviewer fixes on top of v3: captured URL snapshot on Apply, and a `buildMetadataOnly()` helper that returns `null` unless there is real usable content.

## Goal
When V2 AI extraction fully fails but `fetch-url-metadata-lite` still returned usable basics, let the admin prefill **only** name + website URL + images, clearly labelled as metadata-only. The successful AI path is untouched. Stale fields are cleared at Analyze-start (for a new URL); Apply is purely additive and uses a snapshot of the analyzed URL.

## URL normalization helper (new, local to `CreateEntityDialog.tsx`)
Conservative: lowercases hostname, drops a single trailing slash on non-root paths, strips the `#hash` fragment (never identifies a page server-side). **Does not strip query strings** — `?variant=blue` is a genuinely different URL.

```ts
function normalizeUrlForCompare(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return trimmed;
  }
}
```

## New state in `CreateEntityDialog.tsx`
- `const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState<string | null>(null);` — normalized URL of the most recent Analyze attempt. Set on every Analyze click (success or failure).
- `const [metadataUrl, setMetadataUrl] = useState<string | null>(null);` — normalized URL the currently held `urlMetadata` belongs to. Only set when metadata actually arrives.

Two questions, two states:
- `lastAnalyzedUrl` → "Is the user pointing Analyze at a new URL? Clear stale autofill."
- `metadataUrl` → "Is the metadata we have actually for the URL on screen? Safe to render Phase 2 preview."

## Trigger (strict)
Phase 2 UI appears **only** when ALL of:
- Engine is V2.
- `aiPredictions?.predictions == null` (or V2 hard-failed: `v2Failed === true`).
- `urlMetadata` has at least one of: non-empty `title`, non-empty `images[]`, or non-empty `image`.
- **Freshness:** `metadataUrl && metadataUrl === normalizeUrlForCompare(analyzeUrl)`.
- **Usability** (see `buildMetadataOnly` below): after filtering, the object has either a non-empty title or at least one valid image. A website URL alone is not enough.

If `aiPredictions.predictions` exists, Phase 2 is skipped entirely and the existing AI modal renders.

## Analyze-start clearing (in `handleAnalyzeUrl`, before edge-function call)

```ts
const normalizedAnalyze = normalizeUrlForCompare(analyzeUrl);
if (normalizedAnalyze && normalizedAnalyze !== lastAnalyzedUrl) {
  resetAutofillOwnedFields(); // type, category, brand, price, currency, tags, description, structured
  setAiPredictions(null);
  setUrlMetadata(null);
  setMetadataUrl(null);
  setUrlMismatchMessage(null);
}
setLastAnalyzedUrl(normalizedAnalyze); // always update, even on retry
```

Properties:
- **Retry of same URL after a failure does NOT clear again** — `lastAnalyzedUrl` was set on the first attempt even though `metadataUrl` may still be `null`.
- **Trailing-slash / whitespace / hash differences do NOT cause spurious clears.**
- **Never clears** `name`, `website_url`, `uploadedMedia`, `primaryMediaUrl`.

`resetAutofillOwnedFields()` is a small helper next to `applyPredictionsToForm` that calls `handleInputChange(field, getEmptyValueForFieldType(...))` for each listed field.

When metadata is assigned in the existing success path (`setUrlMetadata(metadataResult.data)`), also call:
```ts
setMetadataUrl(normalizedAnalyze);
```
using the normalized value captured at the top of `handleAnalyzeUrl` — never a stale input value the user may have typed since.

## `pickValidImages(urlMetadata)` — new local helper
Returns image URLs that:
- are strings,
- pass `new URL(...)`,
- have `protocol === 'http:' || 'https:'`,
- are not `data:` / `blob:` / `javascript:`,
- are deduped by normalized string.

Returns at most ~8; preview uses first 4, apply uses all.

## `buildMetadataOnly()` — new helper (Codex fix #2)
Centralizes the "do we have usable metadata?" check so the JSX can't accidentally render an empty preview just because a website URL exists.

```ts
function buildMetadataOnly(
  urlMetadata: any,
  analyzeUrl: string,
  metadataUrl: string | null
): { title?: string; websiteUrl?: string; images?: string[] } | null {
  // Freshness guard.
  if (!metadataUrl || metadataUrl !== normalizeUrlForCompare(analyzeUrl)) return null;

  const title = typeof urlMetadata?.title === 'string' ? urlMetadata.title.trim() : '';
  const images = pickValidImages(urlMetadata);

  // Usability guard: title OR at least one valid image is required.
  if (!title && images.length === 0) return null;

  return {
    title: title || undefined,
    websiteUrl: analyzeUrl.trim() || undefined, // captured snapshot — see Apply
    images,
  };
}
```

Called once at modal-render time. The returned `websiteUrl` is the **snapshot** of the analyzed URL at the moment Phase 2 became visible.

## UI — `AutoFillPreviewModal.tsx`
Only the no-predictions branch (lines 232–259) changes. Successful-predictions branch is untouched.

New optional props:
```ts
metadataOnly?: { title?: string; websiteUrl?: string; images?: string[] } | null;
onApplyMetadataOnly?: (snapshot: { title?: string; websiteUrl?: string; images?: string[] }) => void;
```

No-predictions branch rendering:
- Yellow warning icon + request ID (as today).
- Title: *"AI details unavailable"*.
- Description: *"We found basic URL metadata that can help start the form. Please review and complete the remaining fields."*
- If `metadataOnly` non-null:
  - Compact preview: title text, website URL (truncated), up to 4 image thumbnails.
  - Primary button **"Use basic metadata"** → `onApplyMetadataOnly(metadataOnly)`.
  - Secondary **Close**.
- If `metadataOnly` is null: today's Close-only state (unchanged).

Explicitly absent: confidence %, type, category, brand, price, currency, tags, description, structured fields, "AI Reasoning" alert, Sparkles iconography.

## `applyMetadataOnlySafe(snapshot)` — new, purely additive (ChatGPT fix #1)
Receives the same snapshot object the modal rendered from, so any post-render edits to the live `analyzeUrl` input cannot poison the write.

1. `name` ← `snapshot.title` only if current `formData.name` is empty/whitespace.
2. `website_url` ← `snapshot.websiteUrl` only if current `formData.website_url` is empty/whitespace. **Not `analyzeUrl`.**
3. Images: dedupe `snapshot.images` against existing `uploadedMedia` URLs and push new ones (reusing the batched-setState pattern from existing `applyMetadataOnly`). Set `primaryMediaUrl` to the first new image only if `primaryMediaUrl` is currently empty.

Does NOT write or clear: `type`, `category`, `brand`, `price`, `currency`, `tags`, `description`, structured product fields.

Closes modal. Toast: *"Basic metadata applied. Please review and fill the remaining fields."*

## Wiring in `CreateEntityDialog.tsx` (modal render site)
```tsx
const metadataOnly = !aiPredictions?.predictions
  ? buildMetadataOnly(urlMetadata, analyzeUrl, metadataUrl)
  : null;

<AutoFillPreviewModal
  ...
  metadataOnly={metadataOnly}
  onApplyMetadataOnly={applyMetadataOnlySafe}
/>
```

## Untouched
- `applyPredictionsToForm`, successful-prediction modal branch, auto-parent-brand selection/creation.
- Existing `applyMetadataOnly` helper (legacy, left in place; nothing wires to it after this change).
- Edge functions: `analyze-entity-url-v2`, `analyze-entity-url`, `fetch-url-metadata-lite`, `enrich-brand-data`, `create-brand-entity`.
- V1, recovery gate, Firecrawl, Gemini, Zod, merge rules, DB schema, 1.8c.6-B image priority.

## Acceptance checks (manual)
1. **Successful V2** → AI Analysis Results modal with confidence + Apply to Form. No metadata-only UI. Behaviour identical to today.
2. **V2 `predictions: null`, metadata has title/image** → "AI details unavailable" modal with metadata preview + "Use basic metadata" button. Clicking it fills only name + website + images.
3. **V2 hard-fails AND metadata empty** (no title, no valid images) → current Close-only failure state. Metadata-only block is NOT shown just because the URL exists.
4. **Metadata has only filtered-out images** (e.g. all `data:` URIs) and no title → Close-only state. `buildMetadataOnly` returns `null`.
5. **Stale-metadata guard (different URL):** analyze URL A successfully, then analyze URL B which fails entirely — no metadata-only UI for B; A's metadata never appears under B.
6. **URL-input edit between Analyze and Apply (the snapshot fix):** V2 fails for URL A with metadata; user edits the URL input to URL B; user clicks "Use basic metadata" — `website_url` is filled with URL A (the snapshot), not URL B. Title and images also come from URL A.
7. **Manual edit between Analyze and Apply preserved:** V2 fails with metadata; user types into `type` before clicking "Use basic metadata"; their `type` value is preserved (Apply is additive).
8. **New URL clears stale autofill:** analyze URL A successfully (description/tags set), then analyze URL B — A's description/tags clear before B's analyze fires.
9. **Same-URL retry after failure does NOT re-clear:** analyze URL A, metadata fetch fails so `metadataUrl` stays null; user clicks Analyze on URL A again — fields are not cleared a second time, no flicker, no wiped manual edits.
10. **URL normalization:** `https://example.com/product` and `https://example.com/product/` are treated as the same URL (no clear). `https://example.com/product#reviews` is also the same URL. Adding `?utm_source=x` IS treated as different (queries are intentionally preserved).
11. **Image validation:** `data:` / `blob:` / `javascript:` / malformed image URLs in `urlMetadata.images` do not appear in preview and are not added to gallery.

## Out of scope
- Removing the legacy `applyMetadataOnly` function.
- Field provenance tracking (AI-owned vs user-owned).
- Aggressive URL canonicalization (utm stripping, query sort, etc.).
- Any AI extraction-accuracy improvement.
- Any change to V1, DB, or backend.
- Visual redesign of the successful-prediction modal.
