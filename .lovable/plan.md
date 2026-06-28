## Phase 3.2 v6 — Two-Stage Review (Option A, locked)

Adopts ChatGPT + Codex's Option A and clarifications, plus a new accidental-close guard across all stages.

### Flow (Flag ON)

```text
Analyze URL
  ↓
Stage 1 — Review Brand
  • Brand candidates + logo (if any) + website/reason
  • Pick: existing | create new (confirm) | not sure | not listed | not applicable
  • NO entity/product images
  • Button: "Confirm Brand & Continue"  (changes to "Create Brand & Continue" when create_new is the pending choice, with helper text: "This creates the brand now. You can still cancel entity creation later.")
  ↓
  If create_new + confirmed → call create-brand-entity (confirmCreate:true)
  Else → no brand write
  ↓
Stage 2 — Review Entity Draft
  • Summary: suggested name / type / category
  • ImageCandidateGrid (V2 + urlMetadata merged) → pick primary
  • Button: "Apply to Form"  (never "Save")
  ↓
Modal closes → host form prefilled via buildEntityFormPatchFromPredictions
  + parentOverride (Stage 1) + image_url (Stage 2 primary)
  ↓
User reviews/edits full host form
  ↓
Host form Save → entity created
```

Flag OFF: legacy `AutoFillPreviewModal` flow untouched.

### Write-path contract (precise wording)

- Before Confirm Brand → cancel/close/ESC = **zero writes**.
- After explicit `create_new` confirm in Stage 1 → brand row may persist even if Stage 2 or host form is later cancelled. Documented trade-off of confirming brand creation early.
- Closing Stage 2 → **no entity write**, ever.
- Entity creation happens **only** via the host form's existing Save button.
- `existing` / `not_sure` / `not_listed` / `not_applicable` → zero brand writes.

### Accidental-close guard (new, applies to all stages)

The draft modal closes **only** on intentional user action:
- `X` icon in header
- "Cancel" button
- ESC key

It does **not** close on:
- Outside / overlay click (`onPointerDownOutside` → `preventDefault`)
- Focus loss (`onInteractOutside` → `preventDefault` for non-keyboard interactions)
- Auto-close after Stage 1 success (we only advance the internal stage, not dismiss)

Implementation: pass `onPointerDownOutside`/`onInteractOutside` handlers on the Radix `DialogContent` inside `AutoFillPreviewModal` that call `event.preventDefault()` when `useDraftReview` is on. ESC remains enabled (Radix default). Same guard is also applied to the existing legacy modal so the UX is consistent regardless of flag.

### Brand inference fix (do first)

In `supabase/functions/analyze-entity-url-v2/entity_draft.ts`:
- `inferBrandFromUrlSlug`: if the last path segment contains `_`, take the substring **before the first `_`** as the brand slug candidate.
- Display formatting: short all-lower tokens with internal `-` (≤4 chars per side) → uppercase preserving hyphen (`axis-y` → `AXIS-Y`); otherwise Title Case (`dot-key` → `Dot Key`), and prefer the title-ampersand display form (`Dot & Key`) when slug + title agree.
- Confidence ≤ 0.4, `status: 'suggested_new'`, never `recommendedBrandIndex`.
- Telemetry warning: `brand_fallback_source:slug_before_underscore`.

### Code changes

**Frontend**
- `src/components/admin/entity-create/DraftReviewBody.tsx`
  - Add `stage: 'brand' | 'entity'` local state.
  - Stage 1: `BrandPicker` + brand logo block only; button "Confirm Brand & Continue" (or "Create Brand & Continue" + helper note when pending choice is `create_new`).
  - Stage 1 → 2 transition: if `create_new` confirmed, invoke `create-brand-entity` with `confirmCreate:true`; on success store `parentOverride` and advance. Errors stay on Stage 1.
  - Stage 2: name/type/category summary + `ImageCandidateGrid` + "Apply to Form" button.
  - Replaces `onApply` with `onPrefillForm(overrides)`; removes any `handleSubmit` invocation.
  - Uses `buildEntityFormPatchFromPredictions` for the full patch (no partial fills).
- `src/components/admin/entity-create/AutoFillPreviewModal.tsx`
  - Add `onPrefillForm` prop and forward.
  - Add `onPointerDownOutside`/`onInteractOutside` guards on `DialogContent` (applied for both flag states for consistency).
- `src/components/admin/CreateEntityDialog.tsx`
  - New `handlePrefillFromDraft(overrides)`: merge `formPatch` into `formData`, set `tags`, set `selectedParent` from `parentOverride`, merge `metadataOverride`, set `image_url` from `imageOverride`; then close the draft modal. **No** `handleSubmit` call here.
  - `handleSubmit` keeps its `overrides` signature (unused in flag-ON path now) — no behavioral change for flag-OFF.

**Edge function**
- `supabase/functions/analyze-entity-url-v2/entity_draft.ts`: brand-slug fix + telemetry above.
- No new endpoints, no migration, no gallery writes.

### Field parity for Stage 2 → host form prefill

`buildEntityFormPatchFromPredictions` already covers, and we verify mapping for:
name, type, description, website_url, category_id, tags, metadata, specifications, cast_crew, price_info, nutritional_info, external_ratings, ingredients, authors, languages, isbn, publication_year, image_url, plus `selectedParent` (from Stage 1) and `metadata.brand_status` (mutually exclusive with `selectedParent`).

### Acceptance checks
1. Flag OFF: legacy Apply-to-form unchanged.
2. Outside click / overlay click on draft modal at any stage → modal stays open. X / Cancel / ESC → closes.
3. AXIS-Y URL: Stage 1 lists `AXIS-Y` (suggested_new, not recommended), no `Axis Dark`.
4. Stage 1 cancel before confirm → zero writes (verified via logs).
5. Stage 1 `create_new` + confirm → brand row created; cancel Stage 2 → brand persists, no entity row.
6. Stage 2 "Apply to Form" → modal closes; host form shows all legacy-parity fields populated; no DB write.
7. Host form Save → entity created with resolved parent + chosen primary image.
8. `not_sure` / `not_listed` → `metadata.brand_status = 'unknown'`; `not_applicable` → `'not_applicable'`; both cleared if a parent is later set.

### Out of scope
Gallery/multi-image writes, `enrich-brand-data` changes, flag-OFF UI changes.
