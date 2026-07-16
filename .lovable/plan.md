# Search-to-Draft refinement v7

Same as v6, with one targeted change to `variantIsNoisy` and one clarification to the dedup key so that distinct products never collapse.

Everything else in v6 stays: media reset on Search Apply, row thumbnail = `page_metadata` only, `google_grounding` demoted to Draft-Review-only fallback, JSON-LD-first ladder, narrow logo/banner filter, bounded server-side clean-URL retry, no new `CandidateSource` values, URL Analyze untouched.

---

## The one change: safer `variantIsNoisy`

**v6 rule (too aggressive):** default noisy; only real if it matches an allowlisted signal.
Risk: real but unlisted variant words (`molecular`, `clinical`, `barrier`, `brightening`, `advanced`, `intense`, `repair`, `calming`, `ultra`, `pro`, `max`, `deep`, product-line names) get treated as noise and collapse real variants.

**v7 rule (tri-state, default = real):**

```
variantIsNoisy(variant, brand, name):
  v = normalize(variant)          // lowercase, strip punctuation, collapse whitespace
  if !v || v.length < 2                                → NOISY   // empty
  if v ⊆ knownRetailerNames                            → NOISY   // "target", "ulta", "cvs", "walmart", "amazon", "sephora", "nykaa", ...
  if v ⊆ genericFillerList                             → NOISY   // "daily", "standard", "regular", "original", "official", "online",
                                                                 //   "product", "item", "value", "new", "best", "buy", "shop"
  if v exactly equals a normalized token of brand or name → NOISY   // duplicate of brand/name
  if matchesRealVariantSignal(v)                       → REAL    // size/qty, SPF, shade/color, scent, format, formula terms (v6 allowlist)
  otherwise                                            → REAL    // unknown substantive → keep separate (safe default)
```

Net effect:
- `"Target"` / `"Ulta"` / `"official"` / `"daily use"` → NOISY → collapse retailer duplicates.
- `"8 oz"`, `"SPF 50"`, `"Roll-On"`, `"Fragrance Free"` → REAL → stay separate.
- `"molecular repair"`, `"barrier"`, `"clinical"`, `"advanced"`, `"brightening"` → REAL → stay separate.
- Duplicates of brand/name tokens (`variant = "cetaphil"` for a Cetaphil row) → NOISY.

## Dedup key clarification (prevents distinct-product false-merge)

Soft dedup key stays `bnv_soft:${brand}|${name}`, but `name` is normalized with the existing product-name normalizer (already used by `bn0`), which lowercases and strips punctuation but **preserves distinguishing tokens**. So:
- `"Cetaphil Gentle Skin Cleanser"` vs `"Cetaphil Gentle Foaming Cleanser"` vs `"Cetaphil Gentle Clear Pore Cleanser"` → three different `name` values → three different keys → never collapse.
- `"Cetaphil Gentle Skin Cleanser"` at Target + Ulta + CVS with `variant ∈ {"Target", "Daily use", ""}` → same key, all variants NOISY → collapse to one row.

The dedup only collapses when brand AND name AND (variant-is-noisy) all match. Distinct product names never collide.

---

## All other v6 items (unchanged, kept for completeness)

**Bug 2 — Media reset on Search Apply.** In `CreateEntityDialog.onPrefillForm`, when `aiPredictions?.__fromSearch === true`, call `resetEntityFormForNewAppliedUrl()` as the first statement — **before** any `handleInputChange`, `addImageToMediaGallery`, `addGalleryToMediaList`, `setPrimaryMediaUrl`, or `setSelectedParent`. URL Analyze branch untouched. v3 auto-expand block runs after the reset.

**Bug 3 — Row thumbnail = `page_metadata` only.**
- Row shows `page_metadata` image if present; skeleton while enrichment in flight; monogram initials placeholder otherwise.
- `google_grounding` removed from row-thumbnail eligibility. Kept in `imageCandidates` for Draft Review picker, tagged "From Google Search — may not be exact", ranked below every real source. Can only be initial pick when no other candidate exists.
- Broken row-thumbnail image → fall back to initials placeholder.

**Bug 4a — Narrow logo/banner filter** in `enrich-candidate-image`. Reject only when a **pathname segment or filename** (not arbitrary substring), case-insensitive, matches: `logo`, `logos`, `site-logo`, `brand-logo`, `brand_logo`, `brand-banner`, `brand/header`, `header`, `banner`, `sprite`, `placeholder`, `favicon`, `icon`, `default`, `avatar`; or the last segment ends `.svg`. `/brands/cetaphil/cleanser.jpg` passes.

**Bug 4b — JSON-LD-first candidate ladder.** Collect all four candidates (og / twitter / image_src / json_ld), drop those failing `isValidPageImageUrl` or the logo filter, return first survivor in new order: **JSON-LD → OG → Twitter → image_src**.

**Bug 5 — Server-side clean-URL retry.** Inside `enrich-candidate-image`, after primary fetch resolves, retry once with query string stripped **only when all hold**: primary is `no_image` OR `invalid_content_type`; original URL had a non-empty query; ≥1500 ms of the 6 s per-request budget remains. Never retry `unsafe_url`, `timeout`, exhausted-budget, or `blocked`. Retry runs in same request, same quota unit, same rate-limit increment. Final combined result cached under original normalized key. Log `retried: true`.

## No changes to (still out of scope)

- Gemini prompt/model or search backend.
- URL Analyze pipeline.
- `CandidateSource` union (no `enriched`, no new sources — `mergeEnrichedImage` already stores under `page_metadata`).
- New image providers (Google Images API, Firecrawl images, etc.).
- `BrandPicker`, `mergeEnrichedImage` internals.

## Verification

1. `"cetaphil gentle cleanser"` — **duplicate retailer listings of the same exact product collapse into one row**; distinct Cetaphil products (Gentle Skin / Gentle Foaming / Gentle Clear Pore) **remain separate rows**.
2. `"cetaphil moisturizing cream 8 oz"` vs `"16 oz"` — separate rows. Same for SPF 30 vs SPF 50, roll-on vs spray, sensitive vs fragrance-free.
3. Real-but-unlisted variant words (`"molecular"`, `"barrier repair"`, `"clinical"`, `"brightening"`) do **not** cause a collapse.
4. Search "chemist at play roll on" after applying a Cetaphil result → old Cetaphil media is gone from the form; only chemist-at-play media present.
5. First search row never shows a `google_grounding` brand banner — enriched product image or initials only.
6. In Draft Review, `google_grounding` still appears as a picker option (labeled, low-ranked) when present.
7. `/brands/<name>/product.jpg` still enriches; only true logo/banner/icon/svg filenames rejected.
8. Retailer URL with tracking params returning `no_image` on the full URL enriches successfully on the stripped-query retry (single retry, same quota unit).
9. URL Analyze flow unchanged end-to-end.
