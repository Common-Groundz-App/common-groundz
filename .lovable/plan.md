## Verdict on the two reviews

- **Both correct on the core:** server needs missing-logo backfill; client writes only on Stage 1 confirm; never overwrite; never write on preview.
- **ChatGPT's race-safe `WHERE image_url IS NULL`** → adopted.
- **ChatGPT's strict source allowlist** → **not adopted.** `BrandCandidate.source` is the *brand-match* provenance (e.g. `existing_entity`, `admin_manual`), not the *logo* provenance. The logo comes from `resolve-brand-logo`, which we already trust. Gating on `candidate.source` would drop legitimate backfills. **Codex's denylist guard is the right shape.**
- **Both:** pass `creationContext` and add structured logs → adopted.

## Change 1 — Server: race-safe missing-logo backfill in `create-brand-entity`

File: `supabase/functions/create-brand-entity/index.ts`.

Add backfill in **two** branches, before the current `return existing_found`:

**A. Existing brand by name (lines 131–136):**
- Guard: `shouldWrite === true` AND `logo` is a non-empty string AND `!existingBrand.image_url`.
- UPDATE with race guard:
  ```
  .from('entities')
  .update({
    image_url: logo,
    updated_at: new Date().toISOString(),
    metadata: {
      ...(existingBrand.metadata || {}),
      enriched: true,
      enrichment_date: new Date().toISOString(),
      enrichment_source: 'backfill_missing_logo',
    },
  })
  .eq('id', existingBrand.id)
  .is('image_url', null)   // race guard
  .select()
  .maybeSingle()
  ```
- Do NOT touch `name`, `slug`, `website_url`, `description`, `approval_status`, `parent_id`, `created_by`, `user_created`.
- If update returns a row → respond `status: 'backfilled_logo'`, `success: true`, `brandEntity: updatedRow`, HTTP 200.
- If update returns null (row's `image_url` was populated between SELECT and UPDATE) OR errors → log, fall back to existing behavior: `status: 'existing_found'`, `brandEntity: existingBrand`. Never fail the request.

**B. Existing brand by website — active, no name conflict (lines 222–227):**
- Same guard and same UPDATE, keyed on `brandByWebsite.id` with `.is('image_url', null)`.
- Same fallback semantics.

**Structured log** (both branches, success or fallback):
```
console.log(JSON.stringify({
  event: 'brand_logo_backfill',
  ok, brandId, source: creationContext ?? 'unknown',
}));
```

Do **not** modify the soft-deleted-restore branches (lines 195–221, 249–276) — they already set `image_url` correctly.

## Change 2 — Client: call from the existing-brand confirm path

File: `src/components/admin/entity-create/DraftReviewBody.tsx`, inside `handleConfirmBrand` → `brandDecision.kind === 'existing'` branch, immediately after the current `brandRow` SELECT succeeds.

**Guard (all must hold):**
1. `!brandRow.image_url` (nothing to overwrite)
2. `brandDecision.candidate.status === 'matched_existing'`
3. `brandDecision.candidate.logoUrl` is a non-empty string that passes a basic URL check (`new URL(...)` in try/catch, protocol `https:` or `http:`)
4. `brandDecision.candidate.source` is NOT in `{ 'admin_manual', 'user_upload' }` (denylist — trust the resolver for everything else)

**On pass:**
```
await supabase.functions.invoke('create-brand-entity', {
  body: {
    brandName: brandRow.name,
    logo: brandDecision.candidate.logoUrl,
    website: brandRow.website_url ?? null,
    confirmCreate: true,
    creationContext: 'search_existing_backfill', // or 'url_analysis_existing_backfill' if a URL-analysis flag is present in draft/context
  },
});
```
- If `data.status === 'backfilled_logo'` or (`data.success && data.brandEntity?.image_url`), build `parent` from `data.brandEntity`.
- Otherwise fall back to `brandRow` unchanged.
- Wrap in try/catch. **Any failure is soft** — log a warning, continue with `brandRow`, never block Stage 2.

**Client log:**
```
console.log(JSON.stringify({
  event: 'search_brand_logo_backfill',
  ok, brandId: brandRow.id, hadLogo: false, source: 'search',
}));
```

## Cross-flow behavior

- URL Analysis shares `DraftReviewBody.handleConfirmBrand`, so it gets the same backfill automatically. If a flag/field in `draft` distinguishes the two entry points, pass `creationContext: 'url_analysis_existing_backfill'` for URL Analysis; otherwise `'draft_existing_backfill'` is a fine unified value. Either way, the *server* fix benefits both callers.

## Explicit non-goals

- **No writes on preview.** Opening Review Draft, closing it, or seeing the logo chip never mutates the DB.
- **No overwrite, ever.** Guarded on both client (`!brandRow.image_url`) and server (`.is('image_url', null)`).
- **No schema changes.** `image_url`, `metadata`, `updated_at` already exist.
- **No changes to** `resolve-brand-logo`, `SearchEntryPanel`, `applyEntityDraft`, `create_brand_and_entity_atomic`, `analyze-entity-url-v2`, or any migration.
- **No new source enum values.**

## Why the strict source allowlist is skipped

The reviewer's list (`google_images`, `firecrawl`, `page_metadata`, `official_site`, `favicon`) describes *image* provenance. `BrandCandidate.source` in `src/types/entityDraft.ts` describes *brand-match* provenance (`existing_entity`, `admin_manual`, `google_grounding`, etc.). Matching those two enums against each other would reject almost every legitimate backfill — e.g. an existing brand matched via `existing_entity` with a logo resolved by `resolve-brand-logo` would fail the check. The logo itself is trusted because `resolve-brand-logo` already applies its own source filters (CSE / favicon / official site) with its own guardrails. The denylist above (`admin_manual`, `user_upload`) is the right layer — it blocks logos a human typed in the draft form without prior resolver validation.

## Manual verification

1. Flag `entity_extraction.search_brand_logo_lookup_enabled` = ON.
2. Existing `BABE Laboratorios` with `image_url = null` → search a product → Review Draft shows logo chip → Confirm brand → row now has `image_url` and `metadata.enrichment_source = 'backfill_missing_logo'`. Server log `brand_logo_backfill ok:true`, client log `search_brand_logo_backfill ok:true`.
3. Existing brand with `image_url` already set → confirm → no UPDATE (guard trips on client), or race guard drops it silently on server. No new `enrichment_source` in metadata.
4. Cancel Review Draft before confirming → zero writes, zero logs.
5. URL Analysis on an existing brand with no logo → same backfill fires through the shared client path.
6. Flag OFF → no logo resolved → client guard fails on empty `logoUrl` → no invoke, no writes.
7. Simulate race by manually setting `image_url` after opening the draft: server returns `existing_found`, no `enrichment_source` written, client falls back to the freshly-set logo from `brandRow`.
