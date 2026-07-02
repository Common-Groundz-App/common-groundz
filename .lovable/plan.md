# V2 Brand Logo Parity — Plan v3 (final)

Applies both reviewer corrections. No legacy edits, no public shape changes.

## Problem

Legacy `enrich-brand-data` actively fetches brand logos: Google CSE web search → official site → Google CSE image search (site-scoped + broad) → scored ranking → HTML favicon fallback. It succeeds most of the time.

V2 (`analyze-entity-url-v2/entity_draft.ts`) does no active lookup:
- `matched_existing` reuses `entities.image_url`.
- `suggested_new` candidates are pushed with no `websiteUrl` and no `logoUrl`.
- The Fix Pack v3.3 own-origin favicon fallback only runs when `websiteUrl` is already populated — which suggested-new candidates never have.

Result: suggested-new brands (Medicube, AXIS-Y, etc.) essentially never get a logo in V2.

## Fix (V2-only)

### Files

**New:** `supabase/functions/analyze-entity-url-v2/brand_logo_lookup.ts`
- `findOfficialBrandWebsite(brandName, apiKey, cxId, signal)` — port of legacy `findOfficialWebsite` (Google CSE web query `"<brand>" official site`, same social/blocklist filters).
- `searchBrandLogoV2(brandName, officialWebsite, apiKey, cxId, signal)` — port of legacy `searchBrandLogo` + `scoreLogoImage` (site-scoped phase, broad phase, dedupe, scored ranking, `score > 0` guardrail).
- Every returned URL is passed through the existing v3.3 filters (`normalizeLogoUrl` → `isRejectedLogoUrl` → `isAcceptableLogo`) before being accepted. No exceptions.

**Edit:** `supabase/functions/analyze-entity-url-v2/entity_draft.ts` — insert the bounded enrichment stage between brand-candidate assembly and the existing own-origin favicon block.

**Edit:** `supabase/functions/analyze-entity-url-v2/index.ts` — read env, pass into `buildEntityDraft`, gate on flag.

**New migration:** add `entity_extraction.v2_brand_logo_lookup_enabled` to the `set_app_flag` allowlist and validator; seed row.

### Enrichment stage — ordered rules

1. **Pick the target candidate by confidence, not array index.** Priority:
   1. `matched_existing` with exact normalized-name match
   2. `matched_existing` partial match
   3. `suggested_new` candidates in descending `confidence`
2. **Retailer/source-site suppression.** If the top candidate's normalized name matches the host of `inputRef` (e.g. "maccaron" for `maccaron.in`) AND a lower-ranked distinct brand exists in candidates, prefer the distinct brand. Log `v2_brand_logo_retailer_skipped { fromHost }`. This is the Medicube-vs-Maccaron rule.
3. **Never override curated data.** Skip lookup entirely when the picked candidate already has a valid `logoUrl` that survives v3.3 filters.
4. **Skip if normalized-dupe of an existing DB brand.** Uses `normalizeBrandName` from `_shared/brand_normalize.ts`.
5. **Website resolve** — only if picked candidate has no `websiteUrl`. Attach on success, record `SourceEvidence { source: "google_cse" }`.
6. **Logo lookup** — only if still no `logoUrl` after step 5. On success, set `logoUrl`, record `SourceEvidence { source: "google_images" }`.
7. **Own-origin favicon fallback** (existing v3.3 code) runs last, sharing the same abort signal — no separate 2s budget.

### Global timeout (correction #2)

- **One shared `AbortController`, 4 s total budget** covering steps 5 + 6 + 7 combined.
- Step 6 gets `max(0, 4000 − elapsed)` ms. Step 7 gets `max(0, 4000 − elapsed)` ms.
- Budget expiry / any fetch throw → candidate keeps whatever it had. Analyze never fails because of logo lookup.
- Feature-flag off → whole stage no-ops in a single branch, no CSE call.
- Missing `GOOGLE_CUSTOM_SEARCH_API_KEY` or `GOOGLE_CUSTOM_SEARCH_CX` → log `v2_brand_logo_skipped { reason: "no_google_creds" }` and no-op.

### Env vars

Reuse legacy names exactly (verified in `enrich-brand-data/index.ts:86-87`):
- `GOOGLE_CUSTOM_SEARCH_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_CX`

No new secrets. No aliases.

### Feature flag (correction #1)

Key: `entity_extraction.v2_brand_logo_lookup_enabled`
Value shape: `{ "enabled": boolean }` (matches `entity_extraction.review_uses_draft` pattern)

Migration must:
1. Add key to the `_key IN (...)` allowlist inside `public.set_app_flag`.
2. Add an `ELSIF _key = 'entity_extraction.v2_brand_logo_lookup_enabled' THEN` branch that validates exactly `{ "enabled": boolean }` (matching the existing `review_uses_draft` validation pattern).
3. Seed the row with `{"enabled": true}` if missing (idempotent `INSERT … WHERE NOT EXISTS`).
4. Admin-only: **not** exposed via `get_public_flags`. Not added to `ALLOWED_KEYS` in `useAppFlagsAdmin.ts` in this migration — UI toggle can be added later; the flag exists purely as an emergency kill-switch until then.

### Session cache

Per-Analyze in-memory `Map<string, string | null>` keyed by `normalizeBrandName(name) + '|' + host`. Prevents duplicate CSE calls within one invocation. Not persisted.

### Filter reuse (unchanged)

All Google results go through the existing v3.3 filters — `share.google`, `encrypted-tbn*.gstatic.com`, `/s2/favicons`, `/imgres`, redirect wrappers, `srsltid`/UTM stripping, non-image rejection, etc.

### Telemetry (server-side `console.log`, no URLs/PII)

- `v2_brand_logo_stage_start` — `{ candidateSource, hasWebsite, hasLogo }`
- `v2_brand_logo_retailer_skipped` — `{ fromHost }`
- `v2_brand_website_lookup` — `{ ok, ms }`
- `v2_brand_logo_lookup` — `{ ok, ms, source, scoreBucket }`
- `v2_brand_logo_rejected` — reuses existing reason enum
- `v2_brand_logo_quota_exhausted` — distinct signal on HTTP 429 / `quotaExceeded`
- `v2_brand_logo_skipped` — `{ reason: "no_google_creds" | "flag_off" | "already_has_logo" | "normalized_dupe" }`

### Explicitly NOT changed

- `enrich-brand-data`, `fetch-url-metadata-lite`, `_shared/`.
- Public `BrandCandidate` shape.
- v3.3 normalizer, reject lists, own-origin favicon logic (only the abort signal it uses is unified).
- Frontend (`BrandPicker`, `DraftReviewBody`, `AutoFillPreviewModal`).
- `matched_existing` candidates that already have a valid logo.
- `get_public_flags`.

## Validation

1. Re-analyze `maccaron.in/.../medicube_...` → **Medicube** (not Maccaron) is the enriched candidate and gets a `google_images` or favicon logo in BrandPicker.
2. A curated DB brand with existing `image_url` keeps it — no Google override.
3. Retailer-suppression path logs `v2_brand_logo_retailer_skipped`.
4. `share.google` / `encrypted-tbn*` / non-image results still filtered.
5. Google 429 → `v2_brand_logo_quota_exhausted` logged; Analyze completes.
6. 4 s global budget expires → Analyze completes with no logo attached, no error surfaced.
7. `UPDATE app_config SET value='{"enabled": false}' WHERE key='entity_extraction.v2_brand_logo_lookup_enabled'` → next Analyze skips stage (`v2_brand_logo_skipped { reason: "flag_off" }`).
8. Migration idempotency: re-running `set_app_flag` with the same value succeeds; invalid shape (`true` instead of `{"enabled": true}`) raises `invalid_value_for_key`.
9. Legacy smoke: flip pipeline flag to legacy, analyze one URL, succeeds unchanged; `git diff` shows zero changes under `enrich-brand-data/`, `fetch-url-metadata-lite/`, `_shared/`.
10. Latency: P95 Analyze increases by ≤ 4 s only when top candidate had no logo; unchanged otherwise.
