# Phase 1.7 — Page-signal identity anchor for Amazon URLs (V2 only)

Final revision. Folds in all reviewer refinements: codex's dual-path verification, chatgpt's bot-wall/generic title filter and canonical-ASIN consistency check, and codex's prediction_source vs identity-verification separation.

## Why this is happening

`fetch-url-metadata-lite` already fetches Amazon's real HTML and reads the actual product title (e.g. "Root Botanie FOLLIWISE Men Hair Vital Serum + Anti-Pollution Dandruff Protect Scalp Cleanser…"). That is why the preview thumbnails under the Analyze button are correct.

V2 also fetches the same HTML, but its `invokeGemini` only forwards `rawHtml` (truncated, noisy Amazon JS) plus diagnostic flags. The extracted `<title>`, `og:title`, `twitter:title`, JSON-LD `Product.name`, and JSON-LD `Product.brand` are **never put into `V2Evidence`**. Gemini ends up identifying the product from the slug + Google Search neighbors, which is how "Root Hair Serum Dandruff Cleanser" (the slug) and Plantmade-style drift slip past the Phase 1.6 ASIN guard when external grounding is weak or absent.

The fix is to forward the real fetched page signals to Gemini as the primary product-identity evidence for Amazon URLs, and add a distinctive-token page-title guard that runs **independently of** the Phase 1.6 ASIN grounding guard — either path can verify identity.

V1 is not touched. Phase 2 (metadata-only frontend fallback) is not started.

## What changes

Three small, surgical backend changes plus tests. No DB, no frontend, no schema/model/tool changes.

### 1) Surface real page signals from the extractor

`supabase/functions/analyze-entity-url-v2/extractor.ts`
- Add `pageSignals` on `ExtractResult` populated from the HTML the fetcher already returns:
  - `title`, `og_title`, `og_description`, `og_site_name`, `og_image`
  - `twitter_title`, `twitter_description`
  - `canonical`
  - `jsonld_product_name`, `jsonld_brand` — only from JSON-LD blocks whose `@type` includes `Product` (already parsed)
- Each field is `string | null`. No new HTML parsing — reuse the existing `extractMeta()` and JSON-LD walker.
- `ExtractMetadata` (diagnostic flags) unchanged.

### 2) Forward those signals into the Gemini prompt (with explicit Amazon priority)

`supabase/functions/analyze-entity-url-v2/index.ts` (`invokeGemini`, primary path only)
- Pass `pageSignals` into `buildV2Prompts` so `V2Evidence` carries `title`, `description`, `canonical`, `og` (title, description, site_name only — `og_image` is **not** forwarded to the prompt to avoid prompt bloat), `twitter` (title, description), and a minimal `jsonld` array containing only Product blocks (`name`, `brand`). `og_image` remains on `pageSignals` for diagnostics but is dropped before prompt assembly.
- **pageSignals dominate noisy HTML on Amazon:** for Amazon URLs where any `pageSignals` field is non-null, `buildBoundedEvidence` must keep pageSignals fields (title/og/twitter/jsonld) before any other truncation, and aggressively shrink `rawHtml`/`textBody` so the noisy Amazon JS cannot drown out the clean signals. Asserted in tests. No change to truncation order on non-Amazon URLs.

`supabase/functions/analyze-entity-url-v2/prompt-generator-v2.ts`
- In `buildAmazonAsinAnchorBlock` (only rendered when `amazon_asin` is present) add these rules, using an **ordered anchor hierarchy** (do not call all signals equally authoritative):
  - "For amazon_asin, the canonical product-name identity comes from the actual fetched Amazon HTML. Use this ordered hierarchy (strongest first): `jsonld_product_name` → `og_title` → `twitter_title` → cleaned `<title>`. The URL slug is a weak fallback only."
  - "If a Google Search neighbor disagrees with the strongest available anchor for this ASIN, prefer the anchor or return minimal values — do not return the neighbor's product."
  - **"Brand rule (conservative): set `additional_data.brand` ONLY from JSON-LD `Product.brand` or another explicit brand metadata field. Do NOT infer brand from the first token of the page title, og:title, or `amazon_path_slug`. If no explicit brand signal exists, set `brand: null` and `field_confidence.brand: 0`."**
- Search-only fallback prompt body is unchanged (no HTML available by design; guards still run post-hoc).

### 3) Extend the ASIN guard with dual-path identity verification, bot-wall filter, and canonical-ASIN check

`supabase/functions/analyze-entity-url-v2/amazon_asin_guard.ts`

**3a) Bot-wall / generic anchor filter (chatgpt addition #1).** Before any anchor candidate becomes `pageTitleAnchor`, validate it. A candidate is rejected when, after lowercase + trim:
- Length < 4 characters, OR
- Matches any of (substring match, lowercased): `robot check`, `captcha`, `amazon sign-in`, `amazon sign in`, `sign in`, `sorry, something went wrong`, `something went wrong`, `page not found`, `404`, `access denied`, `enter the characters`, OR
- Equals (after stripping `www.`/punctuation) any of the bare site names: `amazon`, `amazon.in`, `amazon.com`, `amazon.co.uk`, `amazon.de`, `amazon.ca`, etc., OR
- After normalization has zero distinctive tokens (post stop-list) — caught later naturally, but we short-circuit here too.

Walk the hierarchy `jsonld_product_name → og_title → twitter_title → cleaned <title>` and pick the first **valid** candidate. If all are invalid → `pageTitleAnchor = null`, `page_title_anchor_reject_reason: "BOT_WALL_OR_GENERIC"`.

**3b) Canonical-ASIN consistency check (chatgpt addition #2).** If `pageSignals.canonical` is present and contains an ASIN (regex `/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i`):
- If the canonical ASIN does NOT match the requested `amazon_asin` → set `pageTitleAnchor = null`, set `amazon_canonical_asin_mismatch: true`, set `page_title_anchor_reject_reason: "AMAZON_CANONICAL_ASIN_MISMATCH"`. The fetched page is not authoritative for the requested ASIN.
- If canonical ASIN matches OR canonical has no ASIN → proceed normally.

**3c) Dual-path verification (codex refinement).** Acceptance now requires **at least one** of the following independent paths to succeed:
- **Path A — External grounding (Phase 1.6):** Gemini grounding chunks contain the ASIN. Model-generated `segment.text` and `webSearchQueries` still excluded from evidence.
- **Path B — Fetched page-title anchor (new):** `pageTitleAnchor` is present (passed 3a+3b), has ≥ 1 distinctive token after stop-word filtering, and the model's returned `name` shares ≥ 1 distinctive token with it.

**3d) Distinctive-token title match:**
- Normalize: lowercase; replace non-alphanumeric with space; collapse whitespace.
- Tokenize; drop tokens with length < 3.
- Drop generic stop-tokens (guard-internal only — never mutates returned `name`):
  - Category/marketing/pack-size: `root, roots, hair, serum, cleanser, dandruff, scalp, oil, treatment, shampoo, conditioner, mask, cream, lotion, gel, spray, balm, men, women, kids, baby, natural, organic, herbal, ayurvedic, vegan, anti, pollution, protect, vital, fall, growth, care, new, pack, set, combo, kit, bottle, refill, ml, gm, mg, kg, count, ct, oz, fl, pcs, piece, value`
  - Platform: `amazon, official, store, india, in, com, www, https, http`
  - Pure-digit tokens: `^\d+$`

**3e) Combined outcomes (evaluated in order):**
- Path A passes AND `pageTitleAnchor` null/no-distinctive-tokens → `{ ok: true, amazon_exact_match_verified: true, page_title_match_verified: null, amazon_identity_verified_via: "external_grounding" }`.
- Path A passes AND anchor distinctive AND model overlaps → `{ ok: true, amazon_exact_match_verified: true, page_title_match_verified: true, amazon_identity_verified_via: "both" }`.
- Path A passes AND anchor distinctive AND model does NOT overlap → **reject** `AMAZON_NAME_PAGE_TITLE_MISMATCH` (fetched page wins over search neighbors).
- Path A fails AND Path B passes → `{ ok: true, amazon_exact_match_verified: false, page_title_match_verified: true, amazon_identity_verified_via: "page_title_anchor" }`. **(codex-refined path)**
- Path A fails AND anchor distinctive AND model does NOT overlap → **reject** `AMAZON_NAME_PAGE_TITLE_MISMATCH`.
- Path A fails AND no usable anchor → **reject** (Phase 1.6 behavior preserved) with existing reject reason.

**3f) prediction_source separation (codex addition #3).** The guard return must NOT set `prediction_source`. `prediction_source` remains whatever the caller already assigned (`gemini_primary`, `gemini_recovery`, `gemini_search_fallback`, etc.). Identity verification is reported only via the diagnostic field `amazon_identity_verified_via`.

`supabase/functions/analyze-entity-url-v2/index.ts` (guard wiring)
- Primary path (when `amazon_asin` present): run guard with `pageTitleAnchor` derived from `pageSignals` after 3a+3b validation.
- **Search-only fallback path:** if `pageSignals` were extracted earlier in the same request, pass `pageTitleAnchor` to the guard (same validation). Fallback prompt body unchanged; only post-response guard gains the anchor input. If no `pageSignals` were ever extracted, behavior identical to Phase 1.6.
- Fail-closed routing on guard rejection is identical in both paths: discard predictions, return `NO_PREDICTIONS`, modal not eligible. **`prediction_source` is not overwritten by the guard in any outcome.**

### Diagnostics (booleans/reason codes only — no raw text, URLs, or HTML)

New fields on the metadata block:
- `page_title_anchor_present: boolean`
- `page_title_match_verified: boolean | null`
- `page_title_match_skip_reason: string | null` (e.g. `NO_DISTINCTIVE_TOKENS`, `NO_PAGE_TITLE_ANCHOR`)
- `page_title_anchor_reject_reason: string | null` (`BOT_WALL_OR_GENERIC`, `AMAZON_CANONICAL_ASIN_MISMATCH`)
- `amazon_canonical_asin_mismatch: boolean`
- `amazon_identity_verified_via: "external_grounding" | "page_title_anchor" | "both" | null`
- Reuse existing `amazon_exact_match_reject_reason` for `AMAZON_NAME_PAGE_TITLE_MISMATCH`.

Per-call log line includes only:
`request_id, amazon_asin_present, amazon_exact_match_verified, amazon_exact_match_reject_reason, page_title_anchor_present, page_title_match_verified, page_title_match_skip_reason, page_title_anchor_reject_reason, amazon_canonical_asin_mismatch, amazon_identity_verified_via, prediction_source, modal_eligible`.

Never log: raw page title, og_image URL, raw HTML, prompt text, raw Gemini output, full URLs with query strings.

### 4) Tests

`extractor_test.ts`
- Fixture HTML with `<title>`, OG fields, Twitter fields, `<link rel="canonical">`, JSON-LD `Product` with `name`+`brand` → all `pageSignals` populated.
- Fixture with no metadata → all `pageSignals` null.

`prompt_v2_test.ts`
- Evidence with `amazon_asin` + populated pageSignals → user prompt contains title/og/twitter/jsonld fields; **does not** contain `og_image`; system prompt contains ordered anchor hierarchy rule **and** conservative brand rule.
- Amazon evidence with pageSignals + bulky rawHtml → `buildBoundedEvidence` retains pageSignals fields and shrinks rawHtml first.
- Non-Amazon evidence → bounded evidence ordering unchanged.
- Evidence without `amazon_asin` → no Amazon anchor block rendered.

`amazon_asin_guard_test.ts`
- **Path A only** (grounding passes, no anchor): accept, `amazon_identity_verified_via: "external_grounding"`.
- **Path B only** (grounding fails, anchor present): accept, `amazon_identity_verified_via: "page_title_anchor"`, `amazon_exact_match_verified: false`.
- **Both paths pass**: `amazon_identity_verified_via: "both"`.
- **Both fail**: reject with Phase 1.6 reason.
- **Anchor mismatch overrides grounding pass**: Path A passes, anchor "Root Botanie FOLLIWISE…", model "Root Hair Serum Dandruff Cleanser" → reject `AMAZON_NAME_PAGE_TITLE_MISMATCH`.
- **Stop-list**: anchor "Root Botanie FOLLIWISE…" vs model "Root Hair Serum Dandruff Cleanser" → only "root" overlaps, in stop-list → reject.
- Model "Hair Serum 100ml" → digits dropped, only generics → reject.
- **Anchor selection**: `jsonld_product_name` chosen over OG/Twitter/title.
- **Bot-wall filter**: `<title>="Robot Check"`, og_title="FOLLIWISE…" → anchor selection skips title, picks og_title. All candidates bot-wall → `pageTitleAnchor=null`, `page_title_anchor_reject_reason: "BOT_WALL_OR_GENERIC"`.
- **Bare site name**: `<title>="Amazon.in"` → rejected as generic.
- **Canonical ASIN match**: canonical `/dp/B0FGJF5QN7/` and requested `B0FGJF5QN7` → anchor used.
- **Canonical ASIN mismatch**: canonical `/dp/B0XXXXX111/`, requested `B0FGJF5QN7` → `pageTitleAnchor=null`, `amazon_canonical_asin_mismatch=true`, `page_title_anchor_reject_reason: "AMAZON_CANONICAL_ASIN_MISMATCH"`. If Path A also fails → reject; if Path A passes → accept via external grounding only.
- **Canonical without ASIN**: anchor used normally.
- **Degenerate anchor** "Hair Serum Cleanser" (only generics) → Path B unavailable, `page_title_match_skip_reason: "NO_DISTINCTIVE_TOKENS"`, falls back to Path A.
- **prediction_source untouched**: caller passes `prediction_source: "gemini_search_fallback"`; guard accept via Path B does NOT mutate it. Assert returned/propagated value still equals input.
- Stop-list does not mutate returned `name` (guard input read-only).
- `pageTitleAnchor=null` → behavior identical to Phase 1.6.

`index.ts` wiring tests:
- HTML fetch succeeds → pageSignals populated → primary Gemini fails → search-only fallback returns "Root Hair Serum Dandruff Cleanser" → guard receives anchor → reject → `NO_PREDICTIONS`, `prediction_source` still reflects fallback source in telemetry.
- HTML fetch succeeds → pageSignals populated → primary Gemini returns FOLLIWISE → grounding empty → Path B verifies → accept, `prediction_source: "gemini_primary"`, `amazon_identity_verified_via: "page_title_anchor"`.
- HTML fetch fails → no pageSignals → fallback runs → guard with `pageTitleAnchor=null` → identical to Phase 1.6.
- Amazon canonical redirects to different ASIN → anchor rejected, Path A determines outcome alone.

## Not changed

V1, `fetch-url-metadata-lite`, frontend, Zod, recovery gate, merge, model, tools, `responseMimeType`, Firecrawl, direct-fetch cap, search-only fallback prompt body, DB, pricing, save flow, RLS, **public `prediction_source` semantics**.

## Acceptance

For `https://www.amazon.in/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/`:
- HTML fetch succeeds, valid anchor: modal shows FOLLIWISE when model returns it (verified via Path A, Path B, or both). Returns `NO_PREDICTIONS` only on real mismatch — never the slug-derived "Root Hair Serum Dandruff Cleanser".
- Amazon serves bot-wall: anchor rejected (`BOT_WALL_OR_GENERIC`), falls back to Path A alone.
- Canonical URL points to different ASIN: anchor rejected (`AMAZON_CANONICAL_ASIN_MISMATCH`), Path A alone determines outcome.
- HTML fetch fails: Phase 1.6 ASIN guard behavior unchanged.
- Brand is either JSON-LD `Product.brand` or `null` — never the first slug/title token.
- `prediction_source` always reflects actual prediction origin (`gemini_primary` / `gemini_recovery` / `gemini_search_fallback`), never `"page_title_anchor"`.

## Retest after build

For each URL report (booleans + reason codes only):
`request_id, pageSignals.title_present, jsonld_product_name_present, amazon_asin_present, amazon_exact_match_verified, page_title_anchor_present, page_title_match_verified, page_title_match_skip_reason, page_title_anchor_reject_reason, amazon_canonical_asin_mismatch, amazon_identity_verified_via, amazon_exact_match_reject_reason (if any), prediction_source, modal_opened_or_no_predictions, final_name, final_brand`.

1. Root Hair Serum Amazon URL (B0FGJF5QN7) — FOLLIWISE or `NO_PREDICTIONS`.
2. Moxie Beauty Amazon URL.
3. Clean Amazon `/dp/<ASIN>/` URL.
4. One successful non-Amazon URL.
5. One non-Amazon search-only fallback URL.
