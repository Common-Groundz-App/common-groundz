
## Phase 3.2 bugfix — v4 (final)

Changes since v3: explicit ampersand-brand rule, conservative-by-default brand fallback (return none on pattern disagreement), and an expanded universality section. Everything else carries over.

## Diagnosis (unchanged)

For Nykaa (`request_id: 3137499f…`) `entity_draft_status: ok` but `merge.field_winners.brand = "none"`. Four cascading issues:

1. `DraftReviewBody.onApply` only sends `parentOverride / metadataOverride / imageOverride`. `handleSubmit` validates against `formData.name` / `formData.type` (never populated by the draft flow) → "Name and type are required".
2. Legacy `applyPredictionsToForm` filled category, tags, description, website, structured metadata, specifications, cast/crew, price, primary media. The draft path silently drops all of it.
3. AI returned empty `additional_data.brand` → BrandPicker shows nothing even though "Dot & Key" / "AXIS-Y" sit in the title/slug.
4. `assembleEntityDraft` only forwards `predictions.images` + `image_url`. Firecrawl `og:image / twitter:image`, extractor gallery URLs, and frontend `fetch-url-metadata-lite` images never reach the draft → 1 tile.

## Fix plan

### A. Pure patch builder (no React state race)

New: `src/components/admin/entity-create/buildEntityFormPatch.ts`
- `buildEntityFormPatchFromPredictions(predictions, urlMetadata, analyzeUrl): EntityFormPatch`.
- Pure. Returns plain object with **every field the legacy `applyPredictionsToForm` writes today**: `name, type, description, website_url, image_url, category_id, tags, metadata, specifications, cast_crew, price_info, nutritional_info, external_ratings, ingredients`, plus type-specific keys.
- Zero React, zero `setState`, zero `toast`.

Refactor `applyPredictionsToForm` in `CreateEntityDialog.tsx` to delegate to the patch builder, then call existing setters (`setFormData / setSelectedTagNames / setUploadedMedia / handleInputChange`). **Flag-OFF behavior is byte-equivalent from the user's POV.**

### B. Draft Review saves a complete entity via direct overrides

`DraftReviewBody.tsx`
- Extend `DraftApplyOverrides` to the full effective field set + `parentOverride`.
- New props: `predictions`, `urlMetadata`, `analyzeUrl`, `extraImageUrls?`.
- **Snapshot guard:** on first render, freeze `predictions` into `predictionSnapshotRef`. A late-arriving re-analyze cannot mutate what the user is reviewing.
- In `handleApplyClick`:
  1. `patch = buildEntityFormPatchFromPredictions(snapshot, urlMetadata, analyzeUrl)`.
  2. Resolve brand decision → `parentOverride` + `metadataOverride.brand_status`.
  3. Resolve `name`: `patch.name` → `snapshot.name` → inline error.
  4. Resolve `type` (see §C).
  5. `metadata = { ...patch.metadata, ...metadataOverride }`; drop `brand_status` if `parentOverride` resolved.
  6. `image_url = imageSelection.primaryUrl ?? patch.image_url`.
  7. `await onApply({ ...patch, name, type, image_url, metadata, parentOverride })`.
- Gallery checkboxes stay disabled.

`CreateEntityDialog.handleSubmit`
- Extend `overrides` to the full patch shape.
- Every field used in validation, slug generation, `entities` insert: `effectiveX = overrides.X ?? formData.X`.
- Required-field validation runs against `effectiveName / effectiveType`.

### C. Tighter type fallback

Resolve type as: `patch.type` → `snapshot.type` → **product** iff at least one product signal:
- URL pathname matches `/\/(p|product|products|dp|item|sku)\//i`
- `urlMetadata` / Firecrawl JSON-LD contains `"@type":"Product"`
- Metadata text matches `/\b(price|sku|add to (cart|bag)|buy now|in stock|out of stock|₹|\$\d)\b/i`

Otherwise → inline error "Pick a type before saving". No silent default.

### D. Brand fallback — conservative-by-default, layered patterns

`supabase/functions/analyze-entity-url-v2/entity_draft.ts` — new `inferBrandFromEvidence({ predictions, url })`, runs only when `additional_data.brand` empty.

**Ordered patterns; first match wins; ties → return none.** Each pattern produces `{ name, source, pattern }`. Run all, collect hits, then:
- 0 hits → no candidate emitted.
- 1 hit → emit as `suggested_new`, `confidence: 0.4`, `reason: "Inferred from <pattern> — please confirm"`.
- ≥ 2 hits with conflicting names → no candidate emitted (ambiguity signal). Log all hits to telemetry.
- ≥ 2 hits agreeing (case-insensitive) → emit, bump confidence to `0.55`.

**Patterns (ordered):**

1. **Structured** — `additional_data.brand_name | manufacturer | vendor` (string, non-empty).
2. **JSON-LD Product.brand** — if Firecrawl returned JSON-LD on `predictions.structured_data`, read `brand.name` or `brand` (string).
3. **OG site_name** — only if pathname looks like a brand homepage (`/` or single segment); skip on deep product URLs to avoid retailer `og:site_name`.
4. **Title — ampersand brand** (Codex correction). Strip leading `^(Buy|Shop|Order|Get|Save on)\s+/i`. Match `^([A-Z][A-Za-z0-9'’]*(?:\s*&\s*[A-Z][A-Za-z0-9'’]*)+)\b`. Hits: "Dot & Key", "Marks & Spencer", "Dolce & Gabbana", "Abercrombie & Fitch".
5. **Title — leading capitalized phrase**. After prefix strip, take tokens until the first lowercase token, separator (`:|–-`), or product-noun match (`sunscreen|serum|cream|lotion|spray|toner|cleanser|mask|gel|oil|shampoo|edt|edp|perfume|cologne|moisturizer|essence|ampoule|sheet`). Require result to be 1–4 tokens AND contain ≥ 1 capitalized token. Reject if any token is in the **stopword list** (`the, a, an, new, best, top, original, official, premium, deluxe, limited`).
6. **Slug — underscore split**. Pathname final segment; if `_` split yields 2+ parts, take part `[0]`. Normalize: lowercase → uppercase hyphenated form (`axis-y` → `AXIS-Y`). Reject if part `[0]` is empty, all-numeric, or in retailer blocklist.
7. **Slug — hyphen walk**. Final segment split on `-`. Walk left-to-right; stop at first generic noise token (`product|p|dp|ref|new|sale|buy|review|item|sku|id`) or any token that is all digits. Require result to be 1–3 tokens. Reject single-character results.

**Retailer blocklist** (applied to every pattern's output, case-insensitive substring match): `nykaa, amazon, flipkart, myntra, maccaron, ajio, tirabeauty, sephora, ulta, walmart, target, ebay, etsy, shopify, meesho, snapdeal, bigbasket, blinkit, zepto, instamart, smytten, purplle, beautybay, lookfantastic, cultbeauty`. Match → discard that pattern's hit.

**Length guard:** any candidate name > 40 chars or < 2 chars → discard.

**Then** run existing `lookupExistingBrandMatches` (read-only). If an existing entity matches → upgrade to `matched_existing`. Otherwise emit one `suggested_new` candidate. `create-brand-entity` still requires `confirmCreate: true` at write time.

**Telemetry** — add to `AnalysisTrace`:
- `entity_draft.brand_fallback_source ∈ {none, structured, jsonld, og_site_name, title_ampersand, title_leading, slug_underscore, slug_hyphen}`
- `entity_draft.brand_fallback_hits: number` (how many patterns fired)
- `entity_draft.brand_fallback_conflict: boolean` (true when ≥ 2 disagreeing hits suppressed the candidate)

### E. Universality posture (the safety net that makes §D OK)

The brand inference can be wrong on the long tail. Three properties make the worst case harmless:

1. **Never written without confirmation.** Inferred candidates are always `suggested_new`, `confidence ≤ 0.55`. `create-brand-entity` requires explicit `confirmCreate: true`. A wrong inference = wrong *suggestion* in BrandPicker; admin picks "Not sure" / "Not listed". No bad row gets written.
2. **High-precision short-circuit; silence on ambiguity.** Ordered patterns, first-hit-wins, **conflict suppression** (§D). Showing zero suggestions is better than showing a wrong one.
3. **Evidence visible.** BrandPicker already renders the candidate's `reason` ("Inferred from title — please confirm"). One-glance sanity check.

This is why we are not trying to make inference "universal" in the LLM sense — we are bounding the cost of being wrong.

### F. More image candidates

Edge — `assembleEntityDraft` builds `extraImageUrls` from Firecrawl `og:image / ogImage / twitter:image`, extractor `additional_data.gallery_images`, and any `predictions.images[*]` not already deduped. Existing dedupe + 12-cap cover the rest.

Frontend — `DraftReviewBody` accepts `extraImageUrls?: string[]` from `urlMetadata.images / urlMetadata.image`, merges with `draft.imageCandidates`, dedupes by exact URL string. URLs stay byte-identical.

### G. Parity safety net

New Vitest: `src/components/admin/entity-create/__tests__/patchParity.test.ts`
- Recorded `V2Predictions` fixture in `__fixtures__/predictions.fixture.json` (one product, one brand).
- Tiny harness drives legacy `applyPredictionsToForm` and captures every `setFormData / setSelectedTagNames / setUploadedMedia` call into a flat object.
- Assert deep-equal against `buildEntityFormPatchFromPredictions(fixture, null, fixtureUrl)`.
- Failing this test = legacy regression.

Second Vitest: `__tests__/brandInfer.test.ts` for §D — table-driven, includes:
- Positive: Dot & Key (title ampersand), Marks & Spencer (title ampersand), AXIS-Y (slug underscore), CeraVe (slug hyphen), Nike (existing-match).
- Negative: pure retailer pages (Nykaa homepage), all-digit slugs, single-letter slugs, stopword-led titles ("The Best Sunscreen 2024"), conflicting title+slug → no candidate.

### H. Explicitly NOT changed

- Legacy "Apply to form" — preserved exactly. Renders when flag OFF, `entityDraft` missing, or `entity_draft_status !== 'ok'`.
- `create-brand-entity` edge function.
- Gallery multi-select / writes — **deferred to Phase 3.3**.
- AI prompt, extra Google Image / Firecrawl fallback calls — deferred.
- DB migrations — none.

## Acceptance checks

- **Nykaa Dot & Key** — `brand_fallback_source: "title_ampersand"`, BrandPicker shows exactly "Dot & Key" (not "Dot & Key Dragon Fruit Bounce"); image grid ≥ 2 tiles when og/Firecrawl images exist; Apply & Save creates entity with full structured metadata; no "Name and type are required" toast.
- **Maccaron AXIS-Y** — `brand_fallback_source: "slug_underscore"`, BrandPicker shows "AXIS-Y"; "Not sure" path still creates with `parent_id = null` and `metadata.brand_status = 'unknown'`.
- **Universality probes** (manual):
  - Marks & Spencer product URL → "Marks & Spencer".
  - CeraVe product URL with hyphen slug → "CeraVe" or similar single-token brand.
  - Nykaa homepage / category page (no product signals) → modal blocks at type; no brand candidate inferred.
  - Ambiguous URL where title says one brand and slug another → `brand_fallback_conflict: true`, no candidate shown, admin picks manually.
  - URL with `the-best-sunscreen-2024` slug and "The Best Sunscreen of 2024" title → no candidate.
- **Race check (code-read):** every field path in `handleSubmit` reads via `overrides.X ?? formData.X`. Zero raw `formData.X` in the insert payload.
- **Snapshot check:** trigger a second analyze while Draft Review is open; the first modal's saved entity matches the first prediction.
- **Parity test:** `patchParity.test.ts` passes.
- **Brand-infer test:** `brandInfer.test.ts` passes all positive/negative cases.
- **Flag OFF:** legacy AI Preview modal renders unchanged; writes identical fields it did before.
- **Logs:** `entity_draft_status: ok`; `brand_fallback_source` populated; `brand_fallback_conflict` populated; no `create-brand-entity` call unless `create_new` confirmed.
