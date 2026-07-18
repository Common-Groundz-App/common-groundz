
## v8b — Firecrawl fallback (final, all ChatGPT + Codex corrections folded in)

Additive, flag-gated, default OFF. Flag OFF → behaves exactly like v8a. URL Analysis code untouched.

**Verified before writing this plan:**
- `firecrawl` already exists in `CandidateSource` (both `src/types/entityDraft.ts` and `supabase/functions/_shared/contracts/entityDraft.types.ts`). No union edit needed.
- Admin panel file is `src/components/admin/AdminFeatureFlagsPanel.tsx`.
- `useAppFlagsAdmin.ts` uses an `ALLOWED_KEYS` tuple that we extend by one entry.

---

## 1. Migration

Add one key + read RPC. `set_app_flag` gets **one new ELSIF branch**, all existing branches preserved verbatim (same pattern as `search_to_draft.non_admin_enabled`).

- Key: `entity_extraction.search_image_firecrawl_enabled`
- Accepted shape: `{ "enabled": boolean }` — nothing else
- Default row inserted: `{ "enabled": false }`
- New RPC: `public.is_search_image_firecrawl_enabled()` — `SECURITY DEFINER`, `STABLE`, returns `boolean`, granted to `anon, authenticated, service_role`.

Post-migration check: `select public.is_search_image_firecrawl_enabled();` returns `false`.

## 2. Backend — `supabase/functions/enrich-candidate-image/index.ts`

### 2a. Import Firecrawl helper (cross-function, temporary)
```ts
// TEMPORARY v8b: cross-function import. Move to _shared/ in a later phase.
import { runFirecrawlScrape } from "../analyze-entity-url-v2/firecrawl.ts";
```
Boot-check right after deploy. **Fallback if edge bundling rejects it:** copy the helper verbatim to `enrich-candidate-image/firecrawl_client.ts` and switch the import — URL Analysis stays untouched.

**Acknowledged side-effect:** the helper emits `[analyze-entity-url-v2] firecrawl.shape_diag` (privacy-safe, host-only). We accept it in v8b. Our `event: "enrich_candidate_image"` line remains the source of truth.

### 2b. Read flag BEFORE computing deadline
```ts
const firecrawlEnabled = await isSearchImageFirecrawlEnabled(supabaseAdmin);
const deadline = Date.now() + (firecrawlEnabled ? 8_000 : 6_000);
```

### 2c. Versioned cache key kept separate from URL (hard requirement)
```ts
const ENRICH_CACHE_VERSION = "v8b";
const normalizedSourceUrl = normalizeCacheKey(sourceUrlRaw);        // used for URL(), fetches, host, SSRF, self-ref
const cacheKey = `${ENRICH_CACHE_VERSION}|${normalizedSourceUrl}`;  // used ONLY for cacheGet/cachePut
```
`new URL(cacheKey)` never runs.

### 2d. Ladder — Firecrawl inserted as step 4
```
1. direct fetch
2. soft-redirect (v8a)
3. clean-URL retry (v8a)
4. firecrawl  — see 2e for gate
5. return no_image
```

### 2e. Firecrawl eligibility — evaluated on the **post-v8a final ladder result** (Codex correction #2)

After steps 1–3 run, compute `currentFinal = { errorCode, method, source, imageUrl }` reflecting the ladder's would-be terminal outcome. Firecrawl runs only when **all** hold:

- `firecrawlEnabled === true`
- `currentFinal.imageUrl == null` (no image found in any prior step)
- `currentFinal.errorCode ∈ {"no_image", "invalid_content_type"}` — i.e., the current final outcome after v8a, not the first direct-attempt error
- `host(normalizedSourceUrl) ∈ FIRECRAWL_HOST_ALLOWLIST = {"vertexaisearch.cloud.google.com"}`
- `Deno.env.get("FIRECRAWL_API_KEY")` is set
- `remainingMs >= 3000`

Explicit **not eligible** even if the flag is on: `blocked`, `unsafe_url`, `timeout`, `rate_limited`, `ssrf_blocked` — regardless of which step produced them. Example: direct = `no_image`, clean-URL retry = `timeout` → currentFinal is `timeout` → Firecrawl does not run.

When gated out, telemetry records `firecrawlSkipReason ∈ {"flag_off","host_not_allowed","ineligible_error","no_api_key","budget_exhausted"}`.

No post-Firecrawl soft-redirect hop.

### 2f. Firecrawl image extraction — full safety pipeline (Codex correction #1)

Two parallel sources from the Firecrawl payload:

**(A) HTML path** — run the existing `extractImageFromHtml(fc.finalUrl, fc.html)` used by v8a (JSON-LD → OG → Twitter → image_src). This path already ends in `looksLikeLogoOrBanner`, `assertSafeUrl`, and `probeImageContentType` — unchanged.

**(B) Metadata path** — first candidate from `metadata.ogImage`, `metadata["og:image"]`, `metadata.twitterImage`, `metadata["twitter:image"]`, `metadata.image` that survives **every** step below, in order:
1. Resolve against `fc.finalUrl` with `new URL(candidate, fc.finalUrl).href` (handles relative URLs)
2. `isValidPageImageUrl(resolved)` — reject tracking pixels / favicons / non-http
3. `looksLikeLogoOrBanner(resolved)` returns false — reject logos, banners, SVGs
4. `assertSafeUrl(resolved)` — SSRF preflight (no internal hosts, no non-http)
5. `probeImageContentType(resolved, remainingMs)` — must return an image content-type

Skip a candidate on any failure; try the next one. If all metadata candidates fail and the HTML path also failed, Firecrawl attempt = `no_image`.

Prefer the HTML-path result over the metadata-path result when both succeed (HTML extractors carry stronger provenance).

### 2g. Method typing
Expand server `method` union to add `"firecrawl_metadata"` only.
- Firecrawl HTML → `source: "firecrawl", method: "json_ld" | "og" | "twitter" | "image_src"`
- Firecrawl metadata → `source: "firecrawl", method: "firecrawl_metadata"`

### 2h. Error-code boundary (hard requirement)
Firecrawl-specific codes (`FIRECRAWL_TIMEOUT`, `FIRECRAWL_HTTP_ERROR`, `FIRECRAWL_INSUFFICIENT_CREDITS`, `FIRECRAWL_BAD_RESPONSE`, `FIRECRAWL_RESPONSE_TOO_LARGE`) live **only inside `attempts[]`**. Public top-level `diagnostics.errorCode` continues to use the existing app-level vocabulary — a failed Firecrawl attempt maps to top-level `no_image`. Frontend contract unchanged.

### 2i. Telemetry
Add to `attempts[]`: `{ kind: "firecrawl", errorCode, method, latencyMs }`. Add top-level `firecrawlSkipReason` when step 4 was gated out. Host-only — no URLs, no HTML, no query text.

## 3. Feature-flag helper — `supabase/functions/_shared/feature_flags.ts`
Append `isSearchImageFirecrawlEnabled(...)` mirroring the existing `readBooleanFlag` pattern (30s TTL). No changes to existing helpers.

## 4. Frontend — Admin Feature Flags UI
- `src/hooks/admin/useAppFlagsAdmin.ts` — append `'entity_extraction.search_image_firecrawl_enabled'` to `ALLOWED_KEYS`.
- `src/components/admin/AdminFeatureFlagsPanel.tsx` — add one row using the existing boolean-flag pattern (same primitives as the `search_to_draft.non_admin_enabled` row).
  - Label: **Search image — Firecrawl fallback** (default OFF)
  - Description: "Last-resort image enrichment for Google/Vertex interstitial search results that fail direct fetch. Search-to-Draft only; URL Analysis unaffected."

## 5. Frontend — Search-to-Draft plumbing (small, additive)
- `src/components/admin/entity-create/applyEntityDraft.ts` — extend `EnrichedImageMethod` union to include `'firecrawl_metadata'`; extend `mergeEnrichedImage` to accept an optional `source` param defaulting to `'page_metadata'`, passing through `'firecrawl'` when supplied. Call sites unchanged.
- `SearchEntryPanel.tsx` — when enrich response returns `source === 'firecrawl'`, forward that source.
- `ImageCandidateGrid.tsx` — Draft Review ranking: `page_metadata → firecrawl → google_grounding`. Firecrawl chip label: **"Rendered page"**.
- Row thumbnail eligibility: `page_metadata → firecrawl → initials`. `google_grounding` still excluded from row thumbnails.

**Note:** `CandidateSource` union is not edited — `firecrawl` already exists in both mirrored files.

## 6. Files touched vs untouched

**Edited (via `supabase--migration` and file edits)**
- Migration
- `supabase/functions/enrich-candidate-image/index.ts`
- `supabase/functions/_shared/feature_flags.ts` (append only)
- `src/hooks/admin/useAppFlagsAdmin.ts`
- `src/components/admin/AdminFeatureFlagsPanel.tsx`
- `src/components/admin/entity-create/applyEntityDraft.ts`
- `src/components/admin/entity-create/SearchEntryPanel.tsx`
- `src/components/admin/entity-create/ImageCandidateGrid.tsx`

**Not touched**
- `supabase/functions/analyze-entity-url-v2/**` (including `firecrawl.ts` and its test)
- `search-entity-candidates` (Gemini prompt, model, dedup)
- All URL Analysis frontend code
- `google_grounding` row-thumbnail policy
- `CandidateSource` union (already contains `firecrawl`)
- Brand-logo / Google CSE code

## 7. Execution + verification order

1. Migration → confirm `is_search_image_firecrawl_enabled()` returns `false`.
2. Edit `enrich-candidate-image` + `_shared/feature_flags.ts` → deploy → **boot-check**. On bundling failure, switch to local `firecrawl_client.ts` copy, redeploy.
3. Edit `useAppFlagsAdmin.ts` + `AdminFeatureFlagsPanel.tsx` + Search-to-Draft plumbing (applyEntityDraft, SearchEntryPanel, ImageCandidateGrid).
4. Open `/admin` Feature Flags tab → confirm new row appears and is OFF.
5. **OFF baseline** — 3 fresh Search-to-Draft searches. Expect zero `kind: "firecrawl"` attempts; eligible rows log `firecrawlSkipReason: "flag_off"`.
6. **URL Analysis smoke** — analyze one known-good Amazon URL + one retailer URL. Zero behavior change expected.
7. Toggle ON via `/admin`.
8. Re-run the same 10 searches from the last round.
9. Report from telemetry:
   - vertex direct `no_image` count
   - firecrawl attempted / success / no_image / timeout / http_error / no_credits counts
   - `method` breakdown on firecrawl successes
   - `firecrawlSkipReason` distribution
   - avg `totalLatencyMs` before vs after
   - any wrong-image / logo case observed in the UI
10. Decision gate:
    - vertex-row success ≥ 40% → keep ON, plan v8c
    - 15–40% → keep ON, tighten logo/banner filter first
    - < 15% → flip OFF, escalate to v8c (Google CSE)
    - Any wrong-image case → tighten filter before widening host allowlist

## 8. Post-v8b cleanup (future, not now)
- Move `firecrawl.ts` to `supabase/functions/_shared/`, update both import sites, verify URL Analysis, delete the old file.
- Add optional `formats` param to `runFirecrawlScrape` so enrich can request `["html"]` only.
- Consider suppressing the helper's shape-diag log for the enrich call site once data is sufficient.
- Widen host allowlist based on v8b telemetry.

---

Approve and I'll execute in the order in section 7.
