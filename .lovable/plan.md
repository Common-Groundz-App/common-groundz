## Problem

In `CreateEntityDialog.tsx`, `resetAutofillOwnedFields()` (line 999) deliberately does NOT clear `uploadedMedia` / `primaryMediaUrl`. Result: when Analyze is re-run with a different URL, the previous URL's images (Bleu de Chanel) stay in the gallery and the new URL's images (Allure Homme Sport) are appended on top of them.

The user has clarified: **manual uploads should also be cleared on URL change**, because a user may have uploaded files for one entity and then pasted a URL for a completely different entity. The entire media set belongs to "the entity currently being analyzed".

## Fix — Phase 2 v6 (scoped, minimal)

Clear **all** media when a new normalized URL is analyzed. Same-URL retries still preserve everything (existing v5 guard).

### Changes — all inside `src/components/admin/CreateEntityDialog.tsx`

1. **Extend `resetAutofillOwnedFields()`** (lines 999–1020) to also reset the media-related state in the same `setFormData` block / alongside it:
   - `setUploadedMedia([])`
   - `setPrimaryMediaUrl(null)`
   - `setFormData(prev => ({ ...prev, image_url: '' }))` (already inside the existing setter — just add the `image_url: ''` field)

2. **Update the comment on lines 997–998** from "Never clears name, website_url, uploadedMedia, primaryMediaUrl." to "Never clears name or website_url. Clears all media and image_url so the gallery always reflects the currently analyzed URL."

3. **No call-site changes needed.** `resetAutofillOwnedFields()` is already invoked exclusively inside the `normalizedAnalyze !== lastAnalyzedUrl` branch in `handleAnalyzeUrl` (line 1038–1044). Same-URL retries will continue to preserve media because the guard already prevents the reset from running.

### Why no tagging / no `isAutofill` marker

- The user explicitly wants manual uploads cleared too on URL change, so distinguishing "autofill vs manual" provides no benefit here.
- Avoids the React anti-pattern of nested state setters that codex flagged.
- Avoids type changes to `MediaItem`.
- The full reset is what already happens for every other autofill-owned field (type, description, tags, parent, etc.) — media now follows the same rule.

## Out of scope (do not touch)

- `addImageToMediaGallery`, `applyMetadataOnly`, `applyMetadataOnlySafe`, `applyPredictionsToForm` insertion logic — unchanged. They will now insert into a known-empty gallery on a new URL, and into the existing gallery on a same-URL retry.
- `normalizeUrlForCompare`, `lastAnalyzedUrl` guard, `metadataUrl` logic — unchanged.
- `AutoFillPreviewModal.tsx` (successful and metadata-only branches) — unchanged.
- All edge functions, V1/V2 routing, Gemini, Firecrawl, Zod, DB schema, merge rules.

## Verification

1. Analyze BLEU DE CHANEL → 5 images appear in gallery.
2. Analyze ALLURE HOMME SPORT (different normalized URL) → BLEU images are gone; only ALLURE images present. `primaryMediaUrl` reflects an ALLURE image (or null if none).
3. Upload a manual file, then analyze a new URL → manual file is also cleared (per user requirement).
4. Click Analyze again on the SAME (failed or successful) URL → media is not cleared (same-URL retry guard still holds via `lastAnalyzedUrl`).
