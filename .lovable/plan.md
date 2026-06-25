# Enable Phase 3.2 Draft Review UI

Phase 3.2 is fully built and wired. The only reason brand/part-of UI isn't appearing is that `app_config['entity_extraction.review_uses_draft']` is set to `{"enabled": false}`. Flipping it on activates the new modal branch for admin users only.

## Steps

1. **Flip the flag** via migration using `set_app_flag`:
   ```sql
   SELECT public.set_app_flag(
     'entity_extraction.review_uses_draft',
     '{"enabled": true}'::jsonb,
     'Phase 3.2 — enable draft-driven review UI for admins'
   );
   ```
   - Writes the audit trail (`app_config_audit`) via the existing RPC.
   - Admin-only RLS on `app_config` is already respected by `useEntityReviewUsesDraft`.
   - Non-admins still see the legacy modal (hook short-circuits to `false`).

2. **Manual verification (you)**:
   - Re-analyze the Nykaa and Maccaron URLs.
   - Expected: modal now shows `BrandPicker` (with existing-match candidates if any, plus a "Create new: <brand>" suggestion or "Not applicable" when no brand was inferred) and `ImageCandidateGrid` instead of the old preview.
   - Click **Apply & Save** → `handleSubmit(overrides)` runs with explicit `parentOverride` / `metadataOverride` / `imageOverride`.

3. **Rollback (if needed)**: same RPC with `'{"enabled": false}'`. No code change required.

## What this does NOT change

- No edits to `analyze-entity-url-v2`, `create-brand-entity`, `enrich-brand-data`, `AutoFillPreviewModal`, `CreateEntityDialog`, `DraftReviewBody`, `BrandPicker`, or `ImageCandidateGrid`.
- No schema changes. No new migrations beyond the one-row flag flip.
- Legacy "Apply to form" path remains intact for non-admins and as fallback.

## Acceptance

- Admin sees `BrandPicker` + `ImageCandidateGrid` on the next analyzed URL.
- `create-brand-entity` is called **only** when admin picks "Create new brand" and confirms (via `confirmCreate: true` already in `DraftReviewBody`).
- No `brand_status` written when a parent is resolved (already enforced in `DraftReviewBody`).
