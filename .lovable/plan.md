## Plan v3.1 — v3 + payload-hygiene clarifications

Same scope as v3. Two small hardening clarifications from reviewers, no scope creep.

### Issue 1 — `unknown_key: entity_extraction.review_uses_draft`
**Unchanged from v3.** Migration `CREATE OR REPLACE FUNCTION public.set_app_flag(...)`:
- Add `'entity_extraction.review_uses_draft'` to the allowlist.
- Validate value as exactly `{ "enabled": boolean }` (mirror of `mux.uploads_enabled`).
- Preserve every existing key, validator, `SECURITY DEFINER`, `SET search_path = public`, `has_role(auth.uid(), 'admin')` gate, ownership, and grants verbatim.

### Issue 2a — Manual brand footer never enables
**Unchanged from v3.** In `src/components/admin/entity-create/BrandPicker.tsx`:
- Live-sync `create_new` decision tagged `source: 'admin_manual'` when `manualName.trim().length >= 2` AND both URLs are valid-or-empty AND no unacknowledged exact-name duplicate.
- Rename inner button → **Use typed brand**; per-row duplicate action → **Use existing brand**. Footer stays **Create Brand & Continue**.
- Closing/cancelling the manual form clears the decision only if the active decision is the manual one.
- `manualName` change resets `overrideDup`.

### Issue 2b — Website-URL dedup with explicit conflict UX
**Unchanged from v3.** Backend (`supabase/functions/create-brand-entity/index.ts`) on a live-row `website_url` hit:

1. `normalizedSubmitted === normalizedExisting` → return existing.
2. Names differ AND `creationContext !== 'draft_review_manual'` → preserve current behavior.
3. Names differ AND `creationContext === 'draft_review_manual'` AND `allowWebsiteConflict !== true` → **no write**, return `HTTP 200`:
   ```
   { success: true, status: 'website_conflict',
     candidate: { id, name, slug, image_url, website_url } }
   ```
   Log `brand_dedup_website_conflict_returned`.
4. Names differ AND `creationContext === 'draft_review_manual'` AND `allowWebsiteConflict === true` → skip hijack, fall through to slug + insert. Log `brand_dedup_skipped_website_under_confirm` with both names.

Same name-mismatch gate guards the soft-deleted-by-website restore branch.

### Frontend conflict handling — blocking, status-first

In `src/components/admin/entity-create/DraftReviewBody.tsx`, `handleConfirmBrand` response branches **status-first, mutually exclusive, each returns**:

```ts
if (error) { /* toast */ return; }

if (data?.status === 'website_conflict') {
  setWebsiteConflict({ candidate: data.candidate, submittedName, submittedWebsite });
  return;
}
if (data?.status === 'confirm_required') { /* existing */ return; }
if (data?.success) { /* advance to Stage 2 */ }
```

While `websiteConflict` is set: footer disabled, no Stage 2 advance, no modal close, no `parentOverride`.

### Conflict action payload hygiene (ChatGPT clarification)

Three actions, each builds its retry payload **from scratch** — never reuses the prior in-flight payload:

- **Clear website** → calls `onClearWebsite()`: sets `manualWebsite` to `''` (see state-ownership note below), re-syncs `BrandDecision` with `websiteUrl: undefined`, clears `websiteConflict`. Admin clicks footer again. **Retry payload is rebuilt from current state** (empty `website`, still `creationContext: 'draft_review_manual'`, `allowWebsiteConflict` omitted).
- **Use existing brand** → swaps `BrandDecision` to `{ kind: 'use_existing', brand: candidate }`, clears `websiteConflict`, immediately re-invokes `handleConfirmBrand`. **The new invoke payload uses the existing-brand path: omit `creationContext`, omit `allowWebsiteConflict`, send only the fields the existing-brand branch needs.** Manual-form state (`manualName`/`manualWebsite`/`manualLogo`) is untouched but ignored by this path.
- **Create anyway** → re-invokes with the same manual payload PLUS `allowWebsiteConflict: true`. On success advances to Stage 2; emits `brand_dedup_skipped_website_under_confirm`.

**`creationContext` rule (unchanged):** only attached when `brandDecision.candidate.source === 'admin_manual'`. Legacy and suggested-new invokes are byte-identical to today.

### State ownership for Clear website (Codex clarification)

`websiteConflict` is owned by `DraftReviewBody` (single source of truth).

`manualWebsite` / `manualLogo` / `manualName` stay in `BrandPicker` (they were already there). The Clear-website action must visibly empty the input — implement via either:
- **Primary approach:** ref-forwarded `clearManualWebsite()` handler exposed from `BrandPicker` to `DraftReviewBody`.
- **Fallback if it gets fragile during implementation:** lift `manualWebsite` / `manualLogo` to `DraftReviewBody` and pass as controlled props. Either way, the visible input must reflect the cleared value before the retry fires, and the retry must read the post-clear value.

### Stale-field + URL validation guard
**Unchanged from v3.**
- Manual form defaults blank; `originalNameRef` set when form opens.
- First time `manualName.trim()` diverges from the ref, clear `manualWebsite` + `manualLogo` once, then stop watching.
- URL validation: empty valid; otherwise `new URL(value)` with `protocol === 'http:' || 'https:'`. Invalid → inline `text-destructive` hint, footer disabled, manual decision not synced.

### Files touched
- New migration (Issue 1).
- `supabase/functions/create-brand-entity/index.ts` — name-mismatch gate, `website_conflict` response, `allowWebsiteConflict` honoring, soft-deleted-by-website gate, reuse `_shared/brand_normalize.ts`.
- `src/components/admin/entity-create/DraftReviewBody.tsx` — status-first mutually-exclusive branches, `websiteConflict` state, three action handlers with clean payload construction, `creationContext` gating.
- `src/components/admin/entity-create/BrandPicker.tsx` — live-sync, button renames, stale-field clear, URL validation, conflict `Alert` rendering, exposed `clearManualWebsite` handler.

### Out of scope
- Stage 2 / image grid.
- Schema/RLS beyond the RPC body.
- Legacy `analyze-entity-url`.
- Logo MIME / image-vs-page checks (only URL validity enforced).

### Validation checklist
1. Pipeline toggle switches Legacy ↔ Draft Review with no `unknown_key`.
2. Typing `Axis-z` with blank URLs enables **Create Brand & Continue**.
3. Manual `Axis-z` with blank website/logo → new `Axis-z`, advances to Stage 2.
4. Manual `Axis-z` with `axis-y.com` → `website_conflict`; UI shows alert; no row; modal stays on Stage 1; `parentOverride` not set.
5. **Clear website** → manual website input visibly empties; retry creates `Axis-z` with empty website. Inspect retry payload: empty `website`, no `allowWebsiteConflict`.
6. **Use existing brand** → resolves to AXIS-Y, no new row, advances to Stage 2. Inspect retry payload: no `creationContext`, no `allowWebsiteConflict`.
7. **Create anyway** → creates `Axis-z` with `axis-y.com`; emits `brand_dedup_skipped_website_under_confirm`; advances to Stage 2.
8. Suggested-new AXIS-Y (not manual) + AXIS-Y website → still returns existing; no `creationContext` sent; byte-identical to today.
9. Legacy auto-create path (no `creationContext`) → byte-identical to today.
10. Invalid URL → inline error; footer disabled.
11. Changing typed name after entering URLs → URLs cleared exactly once; later edits preserved.
