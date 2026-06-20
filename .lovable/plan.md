## Phase 1.8 (final) — Unblock V2 so Phase 1.7 guard actually runs

Folds in all five refinements from chatgpt + codex: strict Amazon host predicate, TextEncoder byte measurement of full request, no prediction values in server telemetry, deterministic per-field caps, and scoping the 4 MiB cap to extraction only.

### Why this phase exists
V2 is failing **upstream of the Phase 1.7 guard**:
- `FETCH_TOO_LARGE` on Amazon HTML > 2 MiB → no pageSignals → guard inert.
- `GEMINI_BAD_RESPONSE` (`finish_reason: STOP`, `has_text_parts: false`) → no parsed prediction → guard inert.

### Scope
V2 only. Untouched: V1, frontend, DB, Zod, save flow, RLS, recovery gate, merge rules, model name, tools list, `responseMimeType`, pricing, the entire Phase 1.7 guard (`amazon_asin_guard.ts`, dual-path verification, bot-wall filter, canonical-ASIN check, conservative brand rule, `prediction_source` semantics). Phase 2 deferred.

### Implementation

**1. Single source of truth for the strict Amazon host predicate**
- Locate the existing strict host helper used by `extractAmazonAsin` / `extractAmazonPathSlug` / `canonicalizeAmazonUrl` (likely in `extractor.ts` or `amazon_asin_guard.ts`).
- If it isn't already exported as a standalone function, extract it as `isStrictAmazonHost(hostname: string): boolean`.
- All new code in Phase 1.8 (`fetcher.ts` cap override, `index.ts` evidence builder) imports **this same function**. No `.includes("amazon")`, no regex duplication.
- Accepts: `amazon.com`, `www.amazon.com`, `amazon.in`, `amazon.co.uk`, `amazon.com.au`, `amazon.co.jp`, `smile.amazon.*`, etc. (whatever the existing helper accepts).
- Rejects: `amazon.in.evil.com`, `notamazon.in`, `amazon-in.com`, `fakeamazon.com`.

**2. Amazon-only 4 MiB direct-fetch cap (extraction only)**
- `fetcher.ts`: `DEFAULTS.maxBytes` stays **2 MiB**.
- `index.ts`: before calling `validateAndFetchUrl`, if `isStrictAmazonHost(new URL(url).hostname)` → pass `maxBytes: 4 * 1024 * 1024`. Otherwise default.
- SSRF, redirect cap, timeout — unchanged.
- The enlarged HTML feeds **only** the extractor (pageSignals/JSON-LD/title). It is **never** forwarded to Gemini when pageSignals exist (see step 4).
- Internal Firecrawl HTML byte cap: if a separate cap exists in our code and currently rejects > 2 MiB Amazon HTML before extraction can run, raise to 4 MiB **for strict Amazon hosts only**. Do **not** change Firecrawl request parameters / crawl behavior. Firecrawl markdown is still excluded from the Gemini prompt on Amazon (step 4) regardless.
- Telemetry (numbers/booleans only):
  - `direct_fetch.max_bytes_used`
  - `direct_fetch.bytes_read` (when known)
  - existing `direct_fetch.bytes` retained

**3. Deterministic per-field caps on the Amazon minimal evidence packet**
Per codex: hard caps applied **before** JSON assembly, so the global byte guard becomes a regression detector, not the normal trimming path.
- `title`: 300 chars
- `og_title`, `twitter_title`: 300 chars each
- `og_description`, `twitter_description`: 280 chars each
- `jsonld_product_name`: 300 chars
- `jsonld_brand`: 200 chars
- canonical URL (path only, no query): 512 chars
- `amazon_path_slug`: 120 chars
- `amazon_asin`: 16 chars (already bounded by format)
- Truncation is plain `.slice(N)`; no ellipsis added (the model should not see synthetic punctuation).

**4. Minimal Amazon evidence packet for Gemini**
- `index.ts` `buildBoundedEvidence` (Amazon branch, gated by `isStrictAmazonHost`):
  - **Trigger**: `pageSignals` has at least one of `jsonld_product_name`, `og_title`, `twitter_title`, cleaned `<title>`.
  - **Whitelist** (each pre-capped per step 3):
    - `amazon_asin`
    - sanitized canonical URL (path only, no query string, no fragments)
    - `amazon_path_slug`
    - `title`, `og_title`, `twitter_title`
    - `og_description`, `twitter_description`
    - `jsonld_product_name`, `jsonld_brand`
  - **Dropped** when this path is active:
    - `rawHtml` entirely
    - Firecrawl markdown entirely
    - Firecrawl HTML
    - All other JSON-LD blobs (only the two whitelisted fields above survive)
    - Image URLs, query strings, previous model output
  - **Fallback**: if no usable pageSignals title → current bounded-evidence behavior unchanged.
- Non-Amazon hosts: **no change**.
- Telemetry:
  - `evidence.amazon_min_packet_used` (bool)
  - `evidence.raw_html_dropped_reason`: `"pagesignals_present" | null`
  - `evidence.firecrawl_markdown_dropped_reason`: `"pagesignals_present" | null`

**5. Cap Gemini thinking + guarantee output budget**
- `gemini.ts` `runGeminiJsonMode` `generationConfig`:
  - `thinkingConfig: { thinkingBudget: 256 }` (start conservative; drop to 0 only if empty STOPs persist).
  - `maxOutputTokens: 2048`
- `gemini_search_fallback.ts`: identical config.
- Recovery Gemini call (if separate path): identical config.
- No change to model name, tools, parser, `responseMimeType`.
- Telemetry from `usageMetadata` (numbers only):
  - `thoughts_token_count`, `candidates_token_count`, `prompt_token_count`, `total_token_count`
  - `has_text_parts` (bool), `json_parse_ok` (bool)

**6. Prompt-byte budget guard (full request, not just userPrompt)**
Per codex correction:
- Use `new TextEncoder().encode(text).length` — **not** `string.length` (which counts UTF-16 code units, not bytes).
- Measure three values right before the Gemini call:
  - `systemPromptBytes`
  - `userPromptBytes`
  - `combinedPromptBytes` (sum, plus any tool/config JSON serialized into the request)
- On the Amazon minimal-packet path, if `combinedPromptBytes > 24 * 1024`:
  - Set telemetry `evidence.amazon_packet_oversize: true`.
  - Truncate the longest description field in the packet by half and remeasure once.
  - Do **not** throw. Do **not** abort the request. This is a regression safety net since per-field caps (step 3) should make oversize impossible under normal conditions.
- Telemetry: `evidence.system_prompt_bytes`, `evidence.user_prompt_bytes`, `evidence.combined_prompt_bytes` (numbers only).

**7. Phase 1.7 guard wiring check (no logic change)**
- Confirm `pageSignals` is still forwarded into `runDualPathVerification` when the minimal-packet path is active. Pure wiring assertion; no behavior change.

### Telemetry policy (per codex)

**Allowed in structured server logs:**
- `request_id`
- All booleans, counts, byte sizes, reason codes, source labels listed above
- `amazon_identity_verified_via` (enum label only: `external_grounding | page_title_anchor | both | null`)
- `amazon_exact_match_reject_reason` (enum)
- `prediction_source` (enum label)
- `error_code` (enum)

**Forbidden in structured server logs:**
- Final `name`, `brand`, `description`, or any other prediction values
- Raw HTML, raw Firecrawl markdown, raw model text
- Full URLs with query strings (paths only)
- PII of any kind

If a retest summary needs final name/brand for a specific URL, take it from the UI manually — never from structured logs.

### Acceptance (re-test same 2 Amazon URLs)
- `direct_fetch.ok: true` for both — no `FETCH_TOO_LARGE`.
- `pageSignals` populated.
- Gemini primary or search fallback returns `has_text_parts: true` + parseable JSON.
- Phase 1.7 guard runs and either:
  - sets `amazon_identity_verified_via ∈ {external_grounding, page_title_anchor, both}` and returns the verified product, OR
  - rejects with a documented reason → `NO_PREDICTIONS`.
- **B0FGJF5QN7 (FOLLIWISE/Root)**: real FOLLIWISE product **or** `NO_PREDICTIONS`. Never slug-derived "Root Serum for Thinning Hair…".
- **MOXIE BEAUTY ASIN**: correct product or a documented guard rejection. Never silent upstream failure.

### Tests (Deno, no network)
- `fetcher_test.ts` / new `host_predicate_test.ts`:
  - Strict Amazon hosts (`amazon.com`, `www.amazon.in`, `amazon.co.uk`, `amazon.com.au`, `amazon.co.jp`, `smile.amazon.com`) → 4 MiB cap.
  - Lookalikes (`amazon.in.evil.com`, `notamazon.in`, `amazon-in.com`, `fakeamazon.com`) → 2 MiB cap.
  - Non-Amazon (`example.com`) → 2 MiB cap.
- `evidence_test.ts` (new):
  - Amazon + pageSignals title present → minimal packet used; `rawHtml` and Firecrawl markdown absent; ASIN/title/OG/Twitter/JSON-LD name+brand present.
  - Minimal packet contains no image URLs, no query strings.
  - Amazon + no pageSignals title → falls back to current bounded evidence (unchanged).
  - Non-Amazon → bounded evidence unchanged.
  - Per-field caps applied (e.g., 1000-char title input → 300 chars in packet).
- `prompt_budget_test.ts` (new):
  - TextEncoder byte measurement is used (UTF-8, not UTF-16).
  - Synthetic oversize Amazon packet → `amazon_packet_oversize: true`, longest description field trimmed, request still proceeds.
- `gemini_test.ts`: `generationConfig` includes `thinkingConfig: { thinkingBudget: 256 }` and `maxOutputTokens: 2048`.
- `gemini_search_fallback_test.ts`: same config.
- Existing V2 suite (FETCH_TOO_LARGE, redirects, SSRF, Phase 1.7 guard) must remain green.

### Risks / mitigations
- `thinkingBudget: 256` may reduce reasoning quality on non-Amazon edge cases. Token telemetry will tell us; one-line tunable.
- 4 MiB Amazon fetch doubles worst-case bandwidth on Amazon hosts only; per-request timeout (unchanged) still bounds total time.
- Per-field caps mean Gemini sees less context — but per Phase 1.7, the guard now validates strictly against pageSignals + ASIN, so any drift is caught rather than rewarded.

### Order of implementation
1. Extract / export `isStrictAmazonHost` (single source of truth).
2. Wire 4 MiB cap in `index.ts` using that predicate; raise internal Firecrawl HTML byte cap symmetrically.
3. Add per-field cap helpers + minimal Amazon evidence packet in `buildBoundedEvidence`.
4. Add TextEncoder-based combined-prompt-bytes measurement + oversize trim.
5. Add `thinkingConfig` + `maxOutputTokens` to primary, recovery, and search-fallback Gemini calls.
6. Add token/byte telemetry (no prediction values).
7. Confirm Phase 1.7 guard still receives `pageSignals` from the new evidence path.
8. Write tests; retest the two failing Amazon URLs.
