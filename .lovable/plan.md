## Problem

`resetAutofillOwnedFields()` currently runs at the **start** of `handleAnalyzeUrl`, so the form is wiped before the user has seen the new prediction. If the user cancels the preview modal, they have already lost the previous URL's data for nothing. The reset must fire only when the user **confirms** via "Apply to Form" or "Use basic metadata", and only when the URL being committed differs from the one currently in the form.

## Fix — Phase 2 v8 (final)

Move the reset from analyze-start to apply-confirm. Track applied URL separately. Compare against the modal's captured URL snapshot, not the live input. Broaden reset scope to include `name`/`website_url`. Rename the helper to match its new responsibility.

### Changes — all inside `src/components/admin/CreateEntityDialog.tsx`

1. **Remove the reset from `handleAnalyzeUrl`.**
   Drop the `resetAutofillOwnedFields()` call (currently around line 1038–1044 inside the `normalizedAnalyze !== lastAnalyzedUrl` branch). Analyze must not mutate any form/media state. It may still update analysis-only state: `loading`, `aiPredictions`, `urlMetadata`, `metadataUrl`, `urlMismatchMessage`, modal open state, and `lastAnalyzedUrl` (kept as-is for analysis retry / metadata-freshness logic).

2. **Rename `resetAutofillOwnedFields()` → `resetEntityFormForNewAppliedUrl()`.**
   The old name is misleading now that the helper clears the full entity state (including `name`, `website_url`, and media). Update the function declaration and both call sites. Add a header comment: "Runs only from the Apply handlers when the user commits a different URL than `lastAppliedUrl`. Clears all entity form fields, structured fields, and media. Never runs from Analyze."

3. **Broaden the reset body to clear the full entity state** in one batched update:
   ```ts
   setFormData(prev => ({
     ...prev,
     name: '',
     website_url: '',
     type: '',
     category: '',
     brand: '',
     description: '',
     tags: [],
     price: '',
     currency: '',
     image_url: '',
     // ...all structured product fields the function already clears
   }));
   setUploadedMedia([]);
   setPrimaryMediaUrl(null);
   ```

4. **Add `lastAppliedUrl` state** (separate from `lastAnalyzedUrl`):
   `const [lastAppliedUrl, setLastAppliedUrl] = useState<string | null>(null);`
   - `lastAnalyzedUrl` = last URL analyzed (unchanged).
   - `lastAppliedUrl` = last URL whose result was committed to the form.

5. **Capture the URL snapshot on the modal payload.**
   When opening `AutoFillPreviewModal` for a successful prediction, record the normalized analyzed URL alongside the predictions in a new state (e.g. `predictionUrlSnapshot`). The metadata-only path already carries `metadataOnly.websiteUrl` — use that as its snapshot. Apply handlers must read these snapshots, never the live `analyzeUrl` input (the user can edit it after the modal opens).

6. **Wire the reset into the apply handlers** via a single controlled helper to avoid setState races:

   ```text
   handleApplyConfirm(snapshotUrl, applyFn):
     const normalized = normalizeUrlForCompare(snapshotUrl)
     const isDifferent = !!normalized && normalized !== lastAppliedUrl
     if (isDifferent) {
       resetEntityFormForNewAppliedUrl()
     }
     applyFn()                        // applyPredictionsToForm / applyMetadataOnlySafe
     setLastAppliedUrl(normalized)
     close modal
   ```

   Both `onApply` and `onApplyMetadataOnly` go through this helper. React 18 auto-batches state updates inside the same synchronous handler, so reset + apply land together. **For any apply path that is async or splits its work across awaits, convert its `setFormData(obj)` calls to `setFormData(prev => ({...prev, ...patch}))`** so the merge always reads the post-reset state. Audit `applyPredictionsToForm` and `applyMetadataOnlySafe` for stale `formData` closures before shipping.

## Notes on same-URL reapply

Reapplying the same URL skips the full reset, but `applyPredictionsToForm` still overwrites the fields it owns. So same-URL reapply preserves manual edits **only for fields the apply function doesn't touch**. True per-field preservation requires field provenance and is explicitly out of scope.

## Out of scope

- `AutoFillPreviewModal.tsx` UI — unchanged (it already calls `onApply` / `onApplyMetadataOnly` props).
- `applyPredictionsToForm`, `applyMetadataOnly`, `applyMetadataOnlySafe`, `addImageToMediaGallery` insertion logic — unchanged (other than the targeted stale-closure audit in step 6).
- `normalizeUrlForCompare`, `lastAnalyzedUrl` semantics for analysis retries / metadata freshness — unchanged.
- Field-provenance / per-field manual-edit preservation — future feature.
- All edge functions, V1/V2 routing, Gemini, Firecrawl, Zod, DB schema, merge rules.

## Verification

1. Fill name + description manually, upload an image. Paste a URL and click Analyze → during analysis and while the preview modal is open, **form stays untouched** (manual image and fields still present).
2. Click **Cancel** on the preview modal → form is still exactly as before. Nothing lost.
3. Apply BLEU DE CHANEL → Bleu fields and images fill in. `lastAppliedUrl` = Bleu normalized URL.
4. Analyze ALLURE HOMME SPORT → while modal is open, Bleu data/media still visible behind it.
5. Click **Apply to Form** on the Allure modal → Bleu name, website_url, fields, and images cleared; Allure data and images fill in. `lastAppliedUrl` = Allure.
6. Metadata-only: previous Bleu apply, then analyze a URL where AI fails → click **Use basic metadata** → old Bleu `name`/`website_url`/media cleared, new title/website/images applied.
7. Edit the `analyzeUrl` input after the modal opens, then click Apply → reset/apply use the modal's captured snapshot URL, not the edited input.
8. Re-analyze and re-apply the **same** URL → no full reset runs; `applyPredictionsToForm` still re-applies its owned fields (documented, not a bug).
