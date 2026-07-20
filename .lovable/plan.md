## v8c — Google CSE image fallback for Vertex rows (FINAL)

Firecrawl on `vertexaisearch.cloud.google.com` interstitials is proven dead. For Vertex rows only, replace it with a Google Custom Search Images fallback, admin-toggleable, default OFF. Non-Vertex flow unchanged.

All reviewer corrections from both rounds are folded in — no more revisions.

## Locked scope

- **Vertex-only.** Only rows whose `sourceUrl` host is `vertexaisearch.cloud.google.com` use CSE.
- Vertex row + CSE flag ON → skip direct/soft/clean **and** Firecrawl → go straight to CSE.
- Firecrawl code + admin flag stay wired (useful later for real JS-rendered retailer pages).
- Reuse existing secrets `GOOGLE_CUSTOM_SEARCH_API_KEY` + `GOOGLE_CUSTOM_SEARCH_CX`.
- Naming: `source: "google_images"`, `method: "google_cse"`. Response field stays **`imageUrl`**.
- Ranking (list + Draft Review): `page_metadata > firecrawl > google_images > google_grounding`.
- Draft Review preselects `google_images` **only** when no `page_metadata`/`firecrawl` image exists.
- Chip on row + review: **"From image search — verify"**.
- Never log raw query text — only `queryHashPrefix` (first 8 chars of sha256).

## Backend

### Migration (single file)
1. Insert `entity_extraction.search_image_cse_fallback_enabled = { "enabled": false }` into `app_config`.
2. Create `is_search_image_cse_fallback_enabled()` SECURITY DEFINER RPC (mirrors existing `is_search_image_firecrawl_enabled`).
3. **Extend `set_app_flag`**: preserve every existing branch verbatim; add the new key to the `IF _key NOT IN (...)` allowlist and add one `ELSIF _key = 'entity_extraction.search_image_cse_fallback_enabled' THEN` branch validating exact `{ "enabled": boolean }` shape.
4. `GRANT EXECUTE` on the new RPC to `anon, authenticated, service_role`.

### `supabase/functions/_shared/feature_flags.ts`
- Add `isSearchImageCseFallbackEnabled(supabaseAdmin?)` — same 30s cache pattern as `isSearchImageFirecrawlEnabled`.

### `supabase/functions/enrich-candidate-image/google_cse.ts` (new file)
- `buildCseQuery({ name, brand, variant })`:
  - Prefer `${name} ${brand ?? ""} ${variant ?? ""} product`.
  - If brand missing, use `${name} ${variant ?? ""} product`.
  - Case-insensitive dedupe removes brand tokens already in name.
  - Collapsed whitespace, capped 128 chars.
  - If sanitized query has fewer than 2 alphanumeric tokens → return `{ query: null, reason: "no_usable_query" }`.
- `runGoogleCseImageSearch({ query, timeoutMs: 2500, fetchImpl })`: single GET to `https://www.googleapis.com/customsearch/v1?searchType=image&num=5&safe=active&imgSize=large`. No retry.
- Module-level state: `cseDailyCount`, `cseDailyResetAt`, `cseDisabledUntil`. Daily cap 90/instance. On HTTP 429 or `error.errors[].reason === "quotaExceeded"`: set `cseDisabledUntil = now + 10min`, return `{ items: [], quotaThrottled: true }`.
- **In-memory LRU cache** (Map, cap ~500, TTL 7 days) keyed by `v8c-cse|<sha256(normalizedQuery).slice(0,32)>`.
- Export `GENERIC_NAME_STOPWORDS`: `["product","products","serum","cream","lotion","cleanser","gel","toner","mask","spray","roll","on","kit","set","pack","bundle","for","with","the","and","de","la","el","new","original","refill"]`.
- Export `LOW_TRUST_CONTEXT_HOSTS`: `["pinterest.com","www.pinterest.com","in.pinterest.com","aliexpress.com","dhgate.com","alibaba.com","ebay.com","poshmark.com","mercari.com","etsy.com"]` (image-mirror / marketplace-spam hosts).

### `supabase/functions/enrich-candidate-image/index.ts`
- Accept optional body fields `brand?`, `variant?`, `type?` (backward-compatible).
- New telemetry attempt kind `google_cse`: `{ kind: "google_cse", errorCode, latencyMs, resultCount, cached, quotaThrottled, queryHashPrefix, selectedImageHost, scoreBreakdown?, scoreable, relevanceMatched }`.
- Top-level result adds `cseUsed: boolean`, `cseAdopted: boolean`, optional `diagnostics.cseSkipReason: "quota_throttled" | "cse_disabled" | "no_usable_query"`.
- **`diagnostics.errorCode` stays within existing union — always `"no_image"` on CSE miss.** CSE-specific state lives only in `attempts[].errorCode` and `diagnostics.cseSkipReason`.

**Vertex-only flow** when `isSearchImageCseFallbackEnabled()` returns true AND `safeHost(normalizedSourceUrl) === "vertexaisearch.cloud.google.com"`:
1. Skip direct/soft/clean (v8b.1 already does).
2. **Skip Firecrawl entirely** (override existing eligibility).
3. Disabled window / quota throttled → push `{ kind: "google_cse", errorCode: "cse_disabled" | "quota_throttled", ... }` (attach `scoreable: false` to **this** attempt, never `attempts[0]`), return `imageUrl: null, errorCode: "no_image", diagnostics.cseSkipReason: <reason>`.
4. `buildCseQuery(...)` → if `no_usable_query`, push equivalent attempt and short-circuit with `diagnostics.cseSkipReason: "no_usable_query"`.
5. Check in-memory cache.
6. Call CSE.
7. Score + validate; adopt best passing image.

**Hard validation rejects (no score):**
- `assertSafeUrl(url)` fails
- `isValidPageImageUrl(url)` fails
- `looksLikeLogoOrBanner(url)` true
- CSE-provided `mime` present and not `image/*`
- CSE-provided `width`/`height` present and either `< 200`
- **`probeImageContentType(url, deadline)` must return `image/*`** (never trust CSE mime alone)

**Scoring (only over validated results):**
- Build token sets from body fields (not query string):
  - `brandTokens` from `body.brand`
  - `nameTokens` from `body.name`, filtered against `GENERIC_NAME_STOPWORDS`
- `scoreable = brandTokens.length > 0 || nameTokens.length > 0`
- If `!scoreable`: adopt first passing result; that attempt entry gets `scoreable: false, relevanceMatched: null`.
- Otherwise for each valid result:
  - `+2` if brandTokens non-empty AND `contextLink` host contains any brand token
  - `+2` if brandTokens non-empty AND `title`/`snippet` (lowercased) contains any brand token
  - `+2` if nameTokens non-empty AND `title`/`snippet` contains any name token
  - `+1` per 500px of the smaller CSE-reported dimension (cap `+3`)
  - `−2` if `contextLink` host is in `LOW_TRUST_CONTEXT_HOSTS`
- **Relevance gate for auto-adopt** (when `scoreable === true`):
  - Adopt only if the chosen result has at least one brand-token OR filtered-name-token match in `contextLink` host, `title`, or `snippet`.
  - If no scored result meets this bar → `cseAdopted: false`, top-level `errorCode: "no_image"`, telemetry `relevanceMatched: false`.
- Adopt highest score; ties broken by CSE result order. Record `relevanceMatched: true|false` on the attempt.

Return shape (unchanged contract):
```
{ imageUrl, source: "google_images", method: "google_cse", confidence: 0.55 }
```

## Frontend

### `src/components/admin/entity-create/SearchEntryPanel.tsx`
- Pass `brand`, `variant`, `type` into the enrichment body.
- Vertex client timeout stays at 12s (v8b.1). Non-Vertex stays 8.5s.

### `src/components/admin/entity-create/ImageCandidateGrid.tsx`
- Ranking: `page_metadata > firecrawl > google_images > google_grounding`.
- Chip **"From image search — verify"** on `google_images` candidates.
- Preselect `google_images` only when no `page_metadata`/`firecrawl` image exists.

### `src/components/admin/entity-create/applyEntityDraft.ts`
- Extend `mergeEnrichedImage` `source` union with `'google_images'`.
- Confidence map: `page_metadata = 0.75`, `firecrawl = 0.7`, `google_images = 0.55`.
- `reason` string for `google_images`: `"Google image search result — verify"`.

### `src/hooks/admin/useAppFlagsAdmin.ts`
- Add `'entity_extraction.search_image_cse_fallback_enabled'` to `ALLOWED_KEYS`.

### `src/components/admin/AdminFeatureFlagsPanel.tsx`
- New toggle row: **"Google image search fallback (Vertex rows)"**
- Description: *"When ON, search-result rows sourced from Google Vertex interstitials that have no page-owned image fall back to Google Custom Search Images. Auto-applied with a 'verify' chip. Uses existing Google CSE quota."*
- Default OFF.

## Out of scope for v8c
- CSE for non-Vertex misses (revisit as v8d once quality data is in).
- Persistent cross-instance CSE cache.
- Removing Firecrawl code or flipping its default.
- Resolving Vertex → real destination redirect.

## Manual verification

**Prep:** `/admin → Feature Flags` → enable **"Google image search fallback (Vertex rows)"**. Keep Firecrawl flag OFF.

Run: `babe laboratorios healthy aging serum`, `cetaphil gentle cleanser`, `chemist at play roll on`.

**Expected in `enrich-candidate-image` logs (Vertex rows):**
- `attempts[]` contains a `google_cse` entry with `scoreable: true` (name tokens exist), `relevanceMatched: true` on most rows.
- Top-level `cseUsed: true`. `cseAdopted: true` on most rows with recognizable brand + product name.
- `cseAdopted: false, diagnostics.errorCode: "no_image", attempts[...].relevanceMatched: false` acceptable when no CSE result matches brand/name tokens.
- `totalLatencyMs` on Vertex rows typically < 4s.
- Only `queryHashPrefix` in logs — never raw query text.
- Repeat run: `attempts[...].cached: true`, no CSE HTTP call.

**Expected in UI:**
- Most Vertex rows show a thumbnail with **"From image search — verify"** chip.
- Rows where CSE returned no safe/relevant image still show initials.
- Draft Review preselects CSE image only when no page/Firecrawl image exists.

**Flag OFF:** Vertex rows fall back to initials (current v8b.1 behavior).

**Quota simulation (optional):** trigger 429 once → subsequent Vertex rows within 10 min show `diagnostics.cseSkipReason: "quota_throttled"`, fall back to initials without hitting CSE.

## Decision gate after v8c
- Consistently good on-brand images → expand to non-Vertex misses (v8d).
- Frequent throttling → tighten daily cap or move to persisted counter.
- Wrong images slipping through → strengthen relevance gate (require both brand AND name token match, or require `contextLink` host to contain a brand token).
