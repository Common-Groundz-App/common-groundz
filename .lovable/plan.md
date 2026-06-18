# Phase 1.6 — Amazon ASIN exact-match protection (V2 only, final + reviewer clarifications)

Final plan, with the two clarifications from codex's last review folded in (regional Amazon hosts, grounding-URL normalization) plus chatgpt's explicit guard-ordering note.

## Scope (V2 only)

- `supabase/functions/analyze-entity-url-v2/host_hints.ts` — add `extractAmazonAsin(url)`.
- `supabase/functions/analyze-entity-url-v2/index.ts` — extract `amazonAsin`, thread into prompt evidence, assemble external-only grounding evidence, run guard, set trace fields, route rejections to NO_PREDICTIONS.
- `supabase/functions/analyze-entity-url-v2/prompt-generator-v2.ts` — ASIN-primary block, `asin=` before `slug=`.
- `supabase/functions/analyze-entity-url-v2/gemini.ts` — surface `groundingChunks[*].web.uri`, `groundingChunks[*].web.title`, `urlContextMetadata[*].retrievedUrl` on the typed response. Do **not** surface `groundingSupports[*].segment.text`, `webSearchQueries`, or model answer text as guard evidence.
- `supabase/functions/analyze-entity-url-v2/amazon_asin_guard.ts` — new.
- Tests: extend `host_hints_test.ts`, `prompt_v2_test.ts`, `gemini_search_fallback_test.ts`; new `amazon_asin_guard_test.ts`.

Untouched: V1, Zod schema, recovery gate, merge rules, tolerant parser, Gemini model/tools, `responseMimeType`, Firecrawl config, direct-fetch cap, frontend, DB, pricing, save flow, RLS.

## Change 1 — ASIN extraction (strict, regional-aware)

`extractAmazonAsin(url)`:
- Parse with `URL`; return `null` on failure.
- **Reuse the existing strict Amazon host predicate** used by `extractAmazonPathSlug` / `canonicalizeAmazonUrl`. That helper already supports multi-label TLDs (`amazon.co.uk`, `amazon.com.au`, `amazon.com.br`, `amazon.co.jp`) and `www.` variants, while rejecting lookalikes (`amazon.in.evil.com`, `notamazon.in`, `amazon-in.com`, `amazon.example.com`). Reusing it avoids drift.
- Match path (case-insensitive) against `/dp/([A-Z0-9]{10})`, `/gp/product/([A-Z0-9]{10})`, `/gp/aw/d/([A-Z0-9]{10})`.
- Uppercase ASIN, validate `^[A-Z0-9]{10}$`. Otherwise `null`.
- Ignore query strings and trailing segments.

`index.ts` computes `amazonAsin` alongside `amazonPathSlug` and passes it on the evidence object for both prompt builders.

## Change 2 — Prompt anchoring (ASIN primary, slug secondary)

In both `buildPrimaryPrompts` and `buildV1StyleSearchFallbackPrompts`:

- Whitelist `amazon_asin` in evidence.
- Hint line order: `asin=<ASIN> host=<host> slug=<slug> mapped_type=<type>`.
- Amazon-only system block (rendered only when `amazon_asin` is present):
  - "`amazon_asin` is the canonical Amazon product identifier and the primary identity anchor for this analysis."
  - "Use the ASIN as the primary search key (e.g. `site:amazon.<tld> <ASIN>` or `<ASIN> amazon`). Do NOT identify the product from the slug alone."
  - "Do NOT return similar, related, sponsored, brand-page, or search-neighbor products. The result MUST be the product at canonical `/dp/<ASIN>/`."
  - "If the exact ASIN page cannot be verified via grounding, set `field_confidence.name` and `field_confidence.brand` low and prefer minimal/empty values over guessing."
  - "Slug is untrusted and only a weak hint. Do NOT infer brand from the first token of the slug or page title."
- Existing untrusted-hint framing for slug stays.

## Change 3 — ASIN guard (external evidence only, normalized)

New `amazon_asin_guard.ts`.

`verifyAmazonAsinGrounding({ amazonAsin, groundingEvidence }) → { ok: true } | { ok: false, reason }`.

`groundingEvidence` is assembled in `index.ts` from **external** Gemini fields only:
- `groundingChunks[*].web.uri`
- `groundingChunks[*].web.title`
- `urlContextMetadata[*].retrievedUrl`

Excluded (must never be passed in):
- prompt text, our canonical URL hint, `webSearchQueries`, `groundingSupports[*].segment.text` (may be model-generated), model answer text, locally constructed strings.

**URL normalization (per codex):** for each candidate URL:
1. Parse with `URL`; on parse failure, fall back to raw lowercased string.
2. Lowercase `host` and `pathname`.
3. `decodeURIComponent(pathname)` (guarded — if it throws, use raw pathname).
4. Drop `search` and `hash`.
5. Match against the four token forms (case-insensitive): `<asin>`, `/dp/<asin>`, `/gp/product/<asin>`, `/gp/aw/d/<asin>`.
   Titles: lowercase + `includes(<asin>)`.

Logic:
1. `amazonAsin` null → `{ ok: true }`.
2. Amazon fallback + empty/missing `groundingEvidence` → `{ ok: false, reason: "AMAZON_ASIN_GROUNDING_UNAVAILABLE" }`. Fail closed.
3. Any token match in any normalized URL / retrievedUrl / title → `{ ok: true }`.
4. Otherwise → `{ ok: false, reason: "AMAZON_ASIN_GROUNDING_MISMATCH" }`.

Wiring in `index.ts` — **explicit ordering (per chatgpt):**

```
Gemini response → tolerant parser → Zod → recovery gate
  → (if accepted) → ASIN guard
    → ok:    prediction proceeds to merge, prediction_source assigned, modal-eligible
    → !ok:   discard prediction, NO_PREDICTIONS path, modal NOT opened
```

- Always runs on the **search-only fallback** Amazon path.
- Also runs on the primary path **only when** `url_context_failed` is true AND the prediction was produced via search grounding (not URL Context retrieval). Otherwise primary path is unchanged.
- On `{ ok: false }`:
  - Discard prediction.
  - Trace: `search_fallback_attempted: true`, `search_fallback_ok: false`, `search_fallback_error: <reason>`, `amazon_exact_match_reject_reason: <reason>`, `skip_reason: null`.
  - Route to existing NO_PREDICTIONS path. No autofill. No modal.

Guard only rejects. Never substitutes.

## Change 4 — Safe diagnostics

Trace fields (Amazon paths where guard runs):

- `amazon_asin_present: boolean`
- `grounding_contains_target_asin: boolean`
- `grounding_contains_canonical_dp_url: boolean`
- `amazon_exact_match_verified: boolean`
- `amazon_exact_match_reject_reason: string | null`
- existing: `search_fallback_attempted`, `search_fallback_ok`, `search_fallback_error`, `skip_reason`

Never logged: raw ASIN value, raw prompt, raw response, full URLs with query strings, HTML, Firecrawl markdown, image URLs, secrets.

## Tests

`host_hints_test.ts` (extend):
- ASIN from `/dp/B0FGJF5QN7/`, `/dp/B0FGJF5QN7`, `/gp/product/B0FGJF5QN7`, `/gp/aw/d/B0FGJF5QN7`.
- Lowercase ASIN normalized to uppercase.
- **Regional hosts accepted:** `amazon.com`, `www.amazon.com`, `amazon.in`, `www.amazon.in`, `amazon.co.uk`, `www.amazon.co.uk`, `amazon.com.au`, `amazon.co.jp`.
- **Lookalikes rejected:** `amazon.in.evil.com`, `notamazon.in`, `amazon.example.com`, `amazon-in.com`.
- Null for non-Amazon, Amazon search URL, storefront URL, malformed ASIN segment.

`prompt_v2_test.ts` (extend):
- `amazon_asin` whitelisted only when present.
- `asin=` precedes `slug=`.
- ASIN-primary block appears only when ASIN present.
- "Do not infer brand from first token" line present.
- Raw HTML / Firecrawl markdown / image-list sentinels still absent.

`amazon_asin_guard_test.ts` (new):
- `{ ok: true }` when ASIN is null.
- `{ ok: true }` when grounding URL contains `/dp/<ASIN>`.
- `{ ok: true }` when retrievedUrl contains `/gp/product/<ASIN>`.
- `{ ok: true }` when chunk title contains the ASIN token.
- **Lowercase ASIN in URL** (`/dp/b0fgjf5qn7/`) accepted after normalization.
- **URL-encoded path** (`/dp/%42%30FGJF5QN7/`) accepted after normalization.
- **Query/fragment stripped** before matching (`/dp/B0FGJF5QN7/?ref=foo#bar`).
- Plantmade-style evidence (URLs reference `plantmade.in/...`, no ASIN) → `MISMATCH`.
- Empty `groundingEvidence` → `UNAVAILABLE`.
- **Model-echo rejection:** ASIN appears only in fields the guard must ignore (simulated `webSearchQueries`, `groundingSupports.segment.text`, prompt-derived strings) and not in chunk URLs/titles or retrievedUrl → `MISMATCH`. Confirms `index.ts` does not surface these fields to the guard.

`gemini_search_fallback_test.ts` (extend):
- Guard-failed fallback → NO_PREDICTIONS with `search_fallback_attempted: true`, `search_fallback_ok: false`, `search_fallback_error` set, `skip_reason: null`, modal-eligibility flag false.
- Guard-passed fallback → prediction reaches merge unchanged.
- Fallback timeout constant remains 20 000 ms.
- Non-Amazon fallback unchanged.

## Retest matrix

For each URL capture: `request_id`, `amazon_asin_present` (boolean), `grounding_contains_target_asin`, `grounding_contains_canonical_dp_url`, `amazon_exact_match_verified`, `amazon_exact_match_reject_reason`, `search_fallback_attempted/ok/error`, `skip_reason`, final `prediction_source`, modal vs NO_PREDICTIONS, whether name/brand match the actual ASIN product.

1. `amazon.in/Root-Hair-Serum-Dandruff-Cleanser/dp/B0FGJF5QN7/` — ASIN product or NO_PREDICTIONS. Plantmade = failure.
2. Moxie Beauty Amazon URL.
3. Clean `amazon.com/dp/<ASIN>/`.
4. One successful non-Amazon URL — unchanged.
5. One non-Amazon URL reaching fallback — unchanged.

## Acceptance criterion

For ASIN `B0FGJF5QN7`, V2 returns the actual ASIN product or NO_PREDICTIONS. Never Plantmade or any similarly named neighbor. Guard failures never open the AI Analysis modal.
