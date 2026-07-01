# Fix Pack v3.2 (Final)

Incorporates ChatGPT + Codex feedback. Two hardening tweaks added on top of the previously proposed v3.2:
- **Logo submission gate:** only send `logoUrl` when the live preview state is exactly `ok` (prevents the race where a bad URL is submitted before `onError` fires).
- **Preview timeout:** 5s watchdog so the preview never sits in `loading` forever.

Legacy pipeline and the existing "suggested new brand" flow are **not** touched.

---

## 1. Backend — `create-brand-entity/index.ts`

Website-conflict override path (when `creationContext === 'draft_review_manual'` and `allowWebsiteConflict === true` with a name mismatch):

- Skip the website-hijack return (already done).
- **Before insert, force `website = null`** — defense in depth even though the frontend also nulls it.
- On insert, add metadata:
  - `website_dropped_due_to_conflict: true`
  - `website_conflict_with_brand_id: <existing.id>`
- Log: `brand_created_without_website_due_to_conflict`.

No changes to legacy/suggested-new paths.

---

## 2. `BrandPicker.tsx` — manual form

**Live logo preview**
- Debounced (~400ms) hidden `<img>` probe of `manualLogo`.
- States: `idle | loading | ok | failed`.
- **5-second watchdog:** if still `loading` after 5s, flip to `failed`.
- UI: small preview thumb when `ok`; muted "Checking image…" when `loading`; `text-destructive` "This doesn't look like a direct image URL — logo will not be saved" when `failed`.
- Wrap `new URL(url).hostname` telemetry in try/catch.

**Submit gate (the Codex tweak)**
- The manual `BrandCandidate` synced to `onChange` includes `logoUrl` **only when `logoPreviewState === 'ok'`**.
- For `idle | loading | failed` → `logoUrl: undefined`.
- Footer stays enabled (brand creation isn't blocked by a bad logo), but the bad URL never reaches the payload.

**Manual selected row**
- When manual candidate is valid, render an extra row inside the "Suggested new brand" list, styled identically, pre-highlighted (`border-primary bg-primary/5`).
- Subtitle: "Inferred from manual entry".
- Uses reserved logo slot; shows preview thumb only when `ok`, else neutral placeholder.
- The "Use typed brand" button flips to "Selected" (disabled outline) while this row is active.
- Closing the manual form clears only the manual decision.

**Duplicate-match row alignment**
- Always render a fixed `h-5 w-5` logo slot (placeholder div when no `image_url`).
- Name: `flex-1 min-w-0 truncate`. Action button: stable width.

**URL sanity**
- Keep existing http/https validation; do not block submit on logo failure.

---

## 3. `DraftReviewBody.tsx` — retry payloads

**"Create without website" (renamed from "Create anyway")**
- Alert copy: *"This website already belongs to {existingBrand.name}. To create a separate brand, we'll leave the website empty — you can edit it later."*
- Retry payload:
  - `website: null`
  - `allowWebsiteConflict: true`
  - `logo`: unchanged from candidate (already gated by BrandPicker rule above)
- Other two actions unchanged: **Clear website** (reset field via imperative handle), **Use existing brand** (switch decision to existing).

---

## 4. `CreateEntityDialog.tsx` — brand chip fallback

- Wrap the brand/parent chip `<img>` with `onError` → swap to a neutral initials/placeholder tile.
- Scope: this dialog only. No global image component changes.

---

## Validation checklist

1. Manual brand "Axis-z" with **AXIS-Y's website** → website_conflict banner appears; footer disabled until an action is chosen.
2. Click **Create without website** → brand created with `website_url = null`, metadata flags present, no 500.
3. Click **Clear website** → website field visibly emptied, decision re-syncs, footer re-enables.
4. Click **Use existing brand** → decision flips to existing AXIS-Y, stage 1 confirms.
5. Manual logo = `https://share.google/...` → preview shows "loading" then flips to "failed" within 5s; brand is still creatable; created entity has `image_url = null`.
6. Manual logo = valid `.png` URL → preview thumb renders; brand created with correct `image_url`.
7. Rapid click on Continue while preview is still `loading` → `logoUrl` NOT sent (gate rule).
8. Two duplicate rows with no logos → names + actions align on the same vertical grid.
9. Click **Use typed brand** → new selected row appears under "Suggested new brand"; button flips to "Selected".
10. Brand chip in CreateEntityDialog with broken `image_url` → shows placeholder tile, no console error.
11. Legacy pipeline toggle still works; suggested-new path unchanged.

---

## Files touched
- `supabase/functions/create-brand-entity/index.ts`
- `src/components/admin/entity-create/BrandPicker.tsx`
- `src/components/admin/entity-create/DraftReviewBody.tsx`
- `src/components/admin/CreateEntityDialog.tsx` (chip fallback only)

## Out of scope
- Google CSE image diversity, `ExtraImageInput`, logo uploader, Stage 2 image grid changes, schema migrations, feature-flag toggle, legacy pipeline.
