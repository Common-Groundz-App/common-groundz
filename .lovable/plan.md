
# v8e (final) — Brand logos for Search rows

Both reviewers approved. All corrections and refinements folded in.

## Reviewer corrections adopted

1. **Env vars:** use `GOOGLE_CUSTOM_SEARCH_API_KEY` and `GOOGLE_CUSTOM_SEARCH_CX` (confirmed used by both `analyze-entity-url-v2` and `enrich-candidate-image/google_cse.ts`).
2. **Frontend path:** `src/components/admin/entity-create/SearchEntryPanel.tsx` (confirmed — no file exists at `src/components/search/SearchEntryPanel.tsx`).
3. **Import fallback:** if the cross-function import from `../analyze-entity-url-v2/brand_logo_lookup.ts` fails at deploy/boot, copy the two helpers (`findOfficialBrandWebsite`, `searchBrandLogoV2`) locally into `resolve-brand-logo/` and keep URL Analyze untouched. URL Analyze files are **never** edited in this phase either way.
4. **Logging:** never log full URLs or raw brand text. Log `brandHashPrefix` (first 8 hex chars of sha256(normalizedBrand)) instead of `brandNorm`. Keep `host`, `source`, `phase`, `ms`, `cached`, `skipReason`.
5. **Duplicated helpers:** the four filter helpers (`normalizeLogoUrl`, `isRejectedLogoUrl`, `isAcceptableLogo`, `tryOwnOriginFavicon`) are copied from `analyze-entity-url-v2/entity_draft.ts` into `resolve-brand-logo/logo_filters.ts` with a header comment:
   ```
   // v8e temporary parity copy of URL Analysis logo filters.
   // Do not change behavior here without syncing with analyze-entity-url-v2/entity_draft.ts.
   // Consolidate into _shared/brand_logo in a later cleanup phase.
   ```

## Design (unchanged from previous draft, restated for approval)

### New edge function `resolve-brand-logo`

- `POST { brand: string }` → `{ logoUrl: string | null, source: "google_images" | "favicon" | "none", cached: boolean, skipReason?: string }`
- **Auth in code** (mirrors `search-entity-candidates`): read bearer, `supabase.auth.getClaims(token)`, 401 on failure. No `config.toml` edit.
- **Input validation:** Zod, `brand: z.string().min(1).max(120)`.
- **Flag:** new `entity_extraction.search_brand_logo_lookup_enabled` in `app_config`; new `is_search_brand_logo_lookup_enabled()` RPC; new `isSearchBrandLogoLookupEnabled()` helper in `_shared/feature_flags.ts`. Default OFF. Admin (`has_role(userId, 'admin')`) bypasses.
- **Rate limit:** in-memory per-instance, 30 lookups/user/rolling-hour. Breach → `{ logoUrl: null, source: "none", skipReason: "rate_limited" }` (HTTP 200).
- **Cache:** in-memory `Map<normalizedBrand, {result, expiresAt}>`, 24 h TTL, positive + negative.
- **Pipeline:** reuse `findOfficialBrandWebsite` + `searchBrandLogoV2` from `analyze-entity-url-v2/brand_logo_lookup.ts` (or local copy per fallback above). Same 4 s internal `AbortController`. Missing Google creds → `skipReason: "no_google_creds"`.
- **Logging:** structured JSON `resolve_brand_logo` events with `{ brandHashPrefix, ok, source, phase, ms, cached, skipReason }`. No URLs, no raw brand text.
- **Boot check:** after first deploy, `curl` the function with `{brand:"test"}` and confirm 401/200 (not 500/import-error). If import fails → apply local-copy fallback and redeploy.

### Search UI — `src/components/admin/entity-create/SearchEntryPanel.tsx`

- After results render, collect `new Set(rows.map(r => r.brand?.name).filter(Boolean))`, cap at 6.
- Session-scoped `useRef<Set<string>>` to skip already-resolved brands.
- Fire `Promise.allSettled(brands.map(b => supabase.functions.invoke('resolve-brand-logo', { body: { brand: b } })))`.
- On each resolution: patch every matching row's brand chip avatar, and patch `draft.brandCandidates[0].logoUrl`.
- No spinner. Initials remain the fallback.

### Admin toggle — `src/components/admin/AdminFeatureFlagsPanel.tsx`

- Label: **Brand logo lookup (Search)**
- Description: *When ON, Search rows fetch brand logos in the background using the same lookup URL Analysis uses. Admins can test even when OFF. Uses the existing Google CSE daily quota.*

## Hard constraints

- Brand logo **never** becomes a product-row thumbnail. Product policy stays `page_metadata > firecrawl > google_images > initials`.
- URL Analyze is **not touched** — no moves, no deletes, no import rewrites. Regression check after deploy: run URL Analyze on one brand URL and confirm `v2_brand_website_evaluated` / `v2_brand_logo_phase` log sequence matches a pre-deploy run.
- No changes to `search-entity-candidates`, `enrich-candidate-image`, dedup, media reset, or Gemini.

## Additions beyond the reviews

Three small things worth adding while we're here:

1. **Auth failure ≠ silent black hole.** If `resolve-brand-logo` returns 401 (e.g. token expired mid-session), the client should not keep retrying — mark the brand as "resolved: no-logo" in the session ref so the row stays on initials until next search. Prevents a broken session from spamming the function.
2. **Skip resolve when a logo is already present.** If a row arrives from `search-entity-candidates` with a non-empty `brand.logoUrl` (rare today, but possible in future), skip the lookup for that brand. Cheap short-circuit.
3. **Telemetry counter for adoption.** Log one summary event per Search render: `search_brand_logo_batch` with `{ unique: N, resolved: M, cached: K, rateLimited: R, ms }`. Gives a single line per search to judge hit-rate without grepping individual events.

## Verification

1. Flag OFF, admin → `chemist at play roll on` → chips fill in on all "Chemist at Play" rows within ~1–2 s. Re-searching same session: `cached:true`.
2. Flag OFF, non-admin → chips stay as initials. Logs: `skipReason:"flag_off"`. Zero CSE calls.
3. Flag ON, any user → chips fill in.
4. `cetaphil gentle cleanser` and `babe laboratorios healthy aging serum` → chips fill in; product thumbnails **unchanged**.
5. URL Analyze regression: same brand URL pre/post deploy → identical log sequence.
6. 40 different brands from one account → post-30, `skipReason:"rate_limited"`.

## Files touched

- **New:** `supabase/functions/resolve-brand-logo/index.ts`
- **New:** `supabase/functions/resolve-brand-logo/logo_filters.ts` (four parity-copy helpers)
- **Modify:** `supabase/functions/_shared/feature_flags.ts` — add `isSearchBrandLogoLookupEnabled()`
- **Migration:** insert `entity_extraction.search_brand_logo_lookup_enabled` into `app_config` (default `false`) + `is_search_brand_logo_lookup_enabled()` RPC
- **Modify:** `src/components/admin/AdminFeatureFlagsPanel.tsx` — new toggle row
- **Modify:** `src/components/admin/entity-create/SearchEntryPanel.tsx` — post-render lookup + state patch

## Out of scope

- Any refactor of `analyze-entity-url-v2/`.
- Extracting shared brand-logo helpers into `_shared/` (separate cleanup after v8e proves out).
- Any change to logo scoring, filters, or fallback order.
- Persistent DB cache for brand logos.
- Backend rate limiting beyond the per-user hourly cap.

Approve and I'll implement.
