## 1.8c.6-A.2 — page_owned_field_source_correction (revised per ChatGPT + Codex)

Adds a second sub-part inside 1.8c.6-A. The already-shipped 1.8c.6-A.1 (page_metadata_fallback_floor) is not touched. This sub-part fixes the remaining original complaint: wrong images / generic descriptions appearing even when Gemini analysis succeeds.

Both reviewers approved with two refinements, both incorporated below:
- Define "page-owned image" to include both extractor image AND Firecrawl metadata image (`flags.firecrawlImageUrl`), via a shared resolver so A.1 and A.2 agree on what counts as page-owned.
- Run every candidate image through a shared validator before it can override Gemini; never accept raw page image values blindly.

### Scope (success path of `mergePredictions` only)

#### 1. Image override (page-owned wins on success)

Define page-owned image source order (highest first):
1. `extract.image_url` (extractor / page direct fetch)
2. `flags.firecrawlImageUrl` (Firecrawl metadata image — already plumbed today, only used in recovery; now also consulted in success)
3. (none → keep Gemini)

A new shared helper `resolvePageOwnedImage(extract, flags)` in `merge.ts` (or a new small `image_validation.ts` shared with `page_metadata_fallback.ts`) returns the first candidate that passes validation. Validation rules (extracted as a single helper, reused by A.1 and A.2):
- Absolute URL, or safely resolved against the submitted page URL.
- `http://` or `https://` only.
- Reject `data:`, `blob:`, `javascript:`, empty, malformed.
- Reject obvious 1×1 tracking pixels, favicons, common placeholder paths where detectable by extension/path hints.
- Dedupe.

Behavior change in success path:
- If `resolvePageOwnedImage` returns a value, set `out.image_url` to it and mark `field_winners.image_url = "extractor"` (when from extract) or `"firecrawl"` (when from `firecrawlImageUrl`). Set new diagnostic `page_owned_image_override_applied = true`.
- If it returns null, keep current behavior (existing rule: Gemini fills only if extractor had none).

`images[]` dedupe order on success:
1. Final page-owned image (if any) — first, never duplicated.
2. Other extractor images.
3. Gemini images.
Existing `dedupeImages` already removes URL duplicates; pass arrays in this order.

#### 2. Description correction (replace weak Gemini description)

New helper `isWeakOrGenericDescription(d)` returns true when:
- missing / empty, OR
- fails existing `isValidDescription` (length <40 or >600, contains `<` or `{`, all-caps), OR
- matches small boilerplate regex set: `/^(buy|shop|order|get|find)\b/i`, `/\b(best price|free shipping|cash on delivery|cod available|lowest price|online shopping)\b/i`, `/\bonline\s+(in|at)\s+[a-z ]+$/i`.

Success-path rule:
- If `isValidDescription(gemini.description)` AND not `isWeakOrGenericDescription(gemini.description)` → keep Gemini (current behavior). `description_source_correction = "kept_gemini"`.
- Else if extract description is present and `isValidDescription` passes → use extract description. `field_winners.description = "extractor"`, `description_source_correction = "replaced_with_page"`.
- Else keep whatever `out.description` already has. `description_source_correction = "kept_extractor"` or `"none"`.

### Out of scope (untouched)

- Semantic fields: `type`, `name`, `brand`, `tags`, `category_id`, `suggested_category_path`, `matched_category_name`, `confidence`, `reasoning`, `price`, `currency`, `pricing` block.
- Junk-name override (unchanged).
- Recovery path (unchanged — already uses `firecrawlImageUrl` first).
- Firecrawl settings, Gemini config, response_schema, parser, recovery gate, Amazon guard, Zod, frontend, DB, V1, category matching.
- `fetch-url-metadata-lite`, `enrich-brand-data` (wait for 1.8c.6-B).
- Google Image Search (not introduced in V2).

### Telemetry (privacy-safe; no raw URLs or descriptions)

Extend `MergeDiagnostics`:
- `field_winners.image_url`: existing union supports `"extractor" | "gemini" | "firecrawl" | "none"`. Used as described above.
- `field_winners.description`: when replacement fires, `"extractor"`.
- New: `page_owned_image_override_applied: boolean`.
- New: `description_source_correction: "kept_gemini" | "replaced_with_page" | "kept_extractor" | "none"`.

Wire both new fields into the existing telemetry log line in `index.ts` if not auto-included. Never log raw `image_url` or `description` strings — source/decision enums only. Reuse existing redaction.

### Files touched

- `supabase/functions/analyze-entity-url-v2/merge.ts` — success-path image + description rules, new helpers, diagnostic fields.
- `supabase/functions/analyze-entity-url-v2/image_validation.ts` (new, small) OR helper inside `merge.ts` — shared image validator + `resolvePageOwnedImage`. If new module, `page_metadata_fallback.ts` is updated to import from it (no behavior change for A.1).
- `supabase/functions/analyze-entity-url-v2/merge_test.ts` — append the tests below (existing tests preserved).
- `supabase/functions/analyze-entity-url-v2/index.ts` — only if the two new diagnostic fields need to be surfaced into the existing telemetry payload; no behavioral change.
- `.lovable/plan.md` — append the 1.8c.6-A.2 section.

### Tests (Deno test on `MergeOutput`)

1. Page-owned (extractor) image wins on successful Gemini result — extract image A, gemini image B → `predictions.image_url === A`, `field_winners.image_url === "extractor"`, `page_owned_image_override_applied === true`.
2. Firecrawl metadata image wins when extractor image missing (Codex refinement) — extract image null, `flags.firecrawlImageUrl = F`, gemini image B → `predictions.image_url === F`, `field_winners.image_url === "firecrawl"`, `page_owned_image_override_applied === true`.
3. No page image at all keeps current behavior — extract image null, no firecrawl image, gemini image B → `predictions.image_url === B`, `field_winners.image_url === "gemini"`, `page_owned_image_override_applied === false`.
4. Invalid page image does NOT override Gemini (validation gate) — extract image `"data:image/png;base64,..."`, gemini image B → `predictions.image_url === B`, `field_winners.image_url === "gemini"`, `page_owned_image_override_applied === false`.
5. Weak / boilerplate Gemini description gets replaced — extract description strong, gemini `"Buy XYZ online at best price"` → page text wins, `description_source_correction === "replaced_with_page"`, `field_winners.description === "extractor"`.
6. Strong Gemini description is kept — gemini valid 100-char informative description → Gemini wins, `description_source_correction === "kept_gemini"`, `field_winners.description === "gemini"`.
7. Semantic-field regression — assert `type`, `name`, `brand`, `tags`, `confidence`, `reasoning`, `price`, `currency`, `pricing` identical to current success-path output for the same fixture.
8. Privacy — JSON-stringify diagnostics; assert it does not contain the test image URL substrings or description text substrings.
9. `images[]` order — page-owned image is first in `predictions.images` and appears exactly once even when also present in extractor.images or gemini.images.

### Execution

1. Add shared image validator + `resolvePageOwnedImage`. If a new module, update `page_metadata_fallback.ts` to import the same validator (no behavior change for A.1; tests for A.1 must still pass).
2. Edit `merge.ts` success path: image override + description correction + new diagnostic fields.
3. Append the 9 tests to `merge_test.ts`. Run via `supabase--test_edge_functions` on `analyze-entity-url-v2`; all pre-existing tests must still pass.
4. If needed, surface new diagnostic fields in `index.ts` telemetry log.
5. Append 1.8c.6-A.2 section to `.lovable/plan.md`.
6. User retests Myntra / Tira / Fila / Amazon non-brand product URLs where Gemini succeeded but a wrong image was shown. If page-owned image now wins, proceed to 1.8c.6-B.
