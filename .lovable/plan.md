## Phase 1.8c.6 — Page-Owned Metadata as Trusted Source (revised; type-safe)

Diagnostics confirmed Firecrawl is working and returning real page-owned data (`og:image`, `og:description`, JSON-LD, markdown, html). The remaining bugs are **consumption + priority** in our pipeline:

1. `analyze-entity-url-v2` can return `NO_PREDICTIONS` even when direct-fetch / Firecrawl already has usable name + description + image.
2. `fetch-url-metadata-lite` / `enrich-brand-data` can surface Google Image Search images that don't exist on the submitted page.

Fix in two ordered sub-steps: **1.8c.6-A** then **1.8c.6-B**. These are **not** Phase 1 / Phase 2 — real Phase 2 (rich metadata UI / category) still follows. Not emailing Firecrawl. Not changing Firecrawl/Gemini settings.

---

### Type-handling decision (revised per ChatGPT + Codex)

`V2Predictions.type` is the non-nullable `CanonicalEntityType` enum. `"others"` exists in that enum but has **product meaning** ("entity does not fit any current type"), **not** "unknown / user must choose". Defaulting unknown-type fallbacks to `"others"` would let users submit unchanged and pollute the DB with mistyped entities.

**Rule for 1.8c.6-A:**

- **Never** set `type: "others"` as an unknown sentinel.
- **Never** guess type from title, URL slug, domain, product words, or a failed/rejected Gemini result.
- The page-metadata fallback prediction is **only emitted when type is reliably resolved** from one of:
  1. JSON-LD `@type` → canonical (`Product` → `product`, `Book` → `book`, `Movie` → `movie`, `TVSeries`/`TVSeason`/`TVEpisode` → `tv_show`, `Recipe` → `food`, `Restaurant`/`LocalBusiness`/`Hotel` → `place`, `SoftwareApplication`/`MobileApplication`/`WebApplication` → `app`, `VideoGame` → `game`, `Course` → `course`, `Event` → `event`, `Service` → `service`).
  2. `og:type` mapped deterministically (`product`, `book`, `video.movie` → `movie`, `video.tv_show` → `tv_show`, etc. — same mapping the existing `category_resolver.ts` `PATH_ALIASES` table uses).
  3. The existing deterministic type resolver in the pipeline, if it returns a supported canonical value.
- If none of the above yields a type, **do not emit a fallback prediction**. Keep the current `NO_PREDICTIONS` behavior and log `page_metadata_fallback_skipped_reason: "type_unresolved"`.
- No Zod / response / DB / frontend changes.

This is safer than the earlier `"others"` proposal and is what both reviewers agreed on. A separate, intentional `needs_type_selection` UI flow can come later (out of scope here).

---

### 1.8c.6-A — V2 page-metadata fallback floor (type-safe)

**File area:** `supabase/functions/analyze-entity-url-v2/` (extractor / merge layer only).

#### Activation rule (all must hold)

- Current flow would otherwise return `NO_PREDICTIONS` (strict floor — never overrides a valid Gemini result).
- Validated page-owned `name/title` present.
- At least one of validated page-owned `description` **or** `image_url` present.
- **Type reliably resolved** from JSON-LD → og:type → deterministic resolver (see above).

`confidence ≤ 0.4`. Telemetry: `page_metadata_fallback_used: true`.

#### Source precedence

**Name / title**
1. JSON-LD `name`
2. `og:title` / `ogTitle`
3. `twitter:title`
4. HTML `<title>` (cleaned — strip site suffix)
5. Firecrawl `metadata.title`
6. First short clean markdown heading

**Description**
1. JSON-LD `description`
2. `og:description` / `ogDescription`
3. `twitter:description`
4. Firecrawl / direct `metadata.description`
5. Short clean markdown excerpt

**Image** (no Google in V2 floor)
1. JSON-LD `Product.image` (or matching `@type.image`)
2. `og:image` / `ogImage`
3. `twitter:image`
4. Firecrawl `metadata.image`
5. Reliable HTML image candidates

#### Conservative merge when Gemini succeeds

Gemini keeps ownership of `type`, `brand`, `tags`, `category`, `confidence`, `reasoning`.

- **`image_url`** — page-owned **always wins** over Gemini. Gemini is not a reliable image source.
- **`description`** — **conservative merge**, not blind override:
  - Use page-owned when Gemini description is missing, empty, very short, or matches generic/boilerplate / cookie / legal patterns.
  - Keep Gemini's when it is substantive and page metadata is weak/truncated.
  - Recorded in `field_source.description` + `description_merge_decision`.
- **`name`** — keep current behavior.

#### Image URL validation

- Resolve relative URLs against the submitted page URL.
- Allow only `http://` / `https://`.
- Reject `data:`, `blob:`, `javascript:`, empty, malformed.
- Reject obvious 1×1 / tracking pixels where detectable.
- Dedupe; prefer same-host / CDN candidates.
- Never log raw image URLs.

#### Telemetry (privacy-safe, source-only)

- `page_metadata_fallback_used: boolean`
- `page_metadata_fallback_skipped_reason`: `"missing_name" | "missing_supporting_field" | "type_unresolved" | "image_invalid" | "not_needed_gemini_succeeded" | null`
- `field_source.name`: `json_ld | og | twitter | html_title | firecrawl | markdown | gemini | none`
- `field_source.description`: same enum + `description_merge_decision`: `gemini_kept | page_filled_gemini_missing | page_replaced_gemini_weak`
- `field_source.image_url`: same enum
- `field_source.type`: `json_ld | og_type | type_resolver | gemini` (never `others_default` — that path no longer exists)
- `image_candidate_count`
- `image_candidate_source_counts`: `{ json_ld, og, twitter, firecrawl, html }`

No raw titles, descriptions, image URLs, markdown, HTML, or model text.

#### Out of scope for 1.8c.6-A

V1, frontend, DB schema, **Zod schema**, response contract, Gemini model/config, `responseMimeType`, token budgets, Firecrawl request settings/timeouts, Amazon guard, recovery gate, merge rules for non-fallback paths, category matching, real Phase 2 UI, any `needs_type_selection` UI flow.

---

### 1.8c.6-B — Image-source priority in metadata-lite / enrich-brand-data

**File area:** `supabase/functions/fetch-url-metadata-lite/index.ts`, `supabase/functions/enrich-brand-data/` (image-selection branch only).

#### Entity-intent rule

"Brand entity" means the **entity itself is Brand** — not a product that merely has a brand attribute. Check explicit entity type, not the presence of a brand field.

- **Brand entity:** keep current behavior — Google Image Search first, page-owned image as fallback. Brand landing pages rarely expose a clean logo via OG tags.
- **All other entities** (product, book, movie, place, food, etc.): page-owned image first:
  1. JSON-LD product image
  2. `og:image` / `ogImage`
  3. `twitter:image`
  4. Firecrawl `metadata.image`
  5. Reliable page HTML / markdown image candidates
  6. Google Image Search **only if** all above missing/invalid

Same image-URL validation as 1.8c.6-A.

#### Telemetry

- `image_source`: `json_ld | og | twitter | firecrawl | page_html | google_search | none`
- `image_priority_path`: `brand_first_google | non_brand_page_first`
- `image_candidate_count`

#### Out of scope for 1.8c.6-B

Brand image priority (preserved), Google Image Search itself, schema changes, UI changes, V1, description/name handling in metadata-lite (image branch only).

---

### Execution order

1. Implement **1.8c.6-A**.
2. Retest: Myntra, Tira, Fila, 1–2 Amazon URLs. Verify Myntra-style PDPs no longer return `NO_PREDICTIONS` **when** JSON-LD/`og:type` gives a reliable type; confirm pages with no reliable type still cleanly skip and log `type_unresolved` instead of inventing `"others"`.
3. Implement **1.8c.6-B**.
4. Retest: 2–3 non-brand product URLs that previously showed wrong images, plus 1–2 brand URLs to confirm brand behavior is unchanged.
5. Then real **Phase 2**.

`FIRECRAWL_SHAPE_DIAG_ENABLED` stays on through all of 1.8c.6 validation.

---

### Why this is safe

- Fallback only fires when current flow would return `NO_PREDICTIONS` — never overrides Gemini.
- No `"others"` sentinel — DB cannot be polluted with mistyped entities.
- No schema / response / DB / frontend change.
- Page metadata can only be used when type is **deterministically** resolvable, so we don't silently mistype anything.
- Conservative description merge protects good Gemini descriptions from weak SEO/boilerplate text.
- Image validation blocks tracking pixels, `data:`, favicons.
- 1.8c.6-B preserves Google-first for **explicit** Brand entities only; products with a brand attribute use page-first.
- Everything observable via privacy-safe `field_source.*` / `image_source` / `page_metadata_fallback_skipped_reason` telemetry.

---

### Explicitly **not** doing

- Not setting `type: "others"` (or any sentinel) when type is unknown.
- Not guessing type from title / slug / domain / product words / failed-Gemini output.
- Not emailing Firecrawl.
- Not changing Firecrawl timeouts/formats/call sites.
- Not changing Gemini model, config, parser, guard, recovery, or non-fallback merge rules.
- Not changing brand image priority.
- Not changing V1, frontend, DB schema, **Zod schema**, response contract, or category matching.
- Not adding a `needs_type_selection` UI/schema flow in this phase.
- Not combining 1.8c.6-A and 1.8c.6-B into one patch.

Approve to proceed with 1.8c.6-A.
