
# Phase 3.5b — Final Plan (v2)

Purely additive. URL flow, 3.5a edge function, feature flags, admin panel, and contract types stay untouched.

Two focused improvements to the Search tab:
1. **Selected-candidate image enrichment** — SSRF-safe, deterministic, cache-first, separately rate-limited.
2. **Existing-match shortcuts** — `Write review` + `Open` only. No `Recommend`.

## Verified before planning

- `/entity/:slug` routes to `src/pages/EntityDetail.tsx`, which conditionally renders one of: `EntityV4` (default for products/most types), `EntityV3`, or `EntityDetailV2` (fallback). Each of those three owns its own `isReviewFormOpen` state and its own `ReviewForm`. → The `?compose=review` auto-open effect must be added to **all three** (small, identical, ~4 lines each).
- `CandidateSource` union already includes `"page_metadata"` in both `src/types/entityDraft.ts` and `supabase/functions/_shared/contracts/entityDraft.types.ts`. No contract change.
- `analyze-entity-url-v2/fetcher.ts` + `ssrf.ts` already implement a DNS-preflight + private-IP rejection + redirect-revalidation pattern (see `assertSafeUrl`, `validateAndFetchUrl`). The new function will **reuse this exact SSRF helper** rather than reinvent it.

## Changes vs previous draft (codex + chatgpt feedback applied)

| Fix | Change |
|---|---|
| Cache must be checked before rate limit | Gate order is now: auth → flags → validate → normalize cache key → **cache lookup** → (miss only) increment quota → fetch. Cache hits never consume quota. |
| SSRF also for extracted image URL | Extracted `og:image` / `twitter:image` / JSON-LD image URL runs through `assertSafeUrl` before HEAD probe or return. Blocks `og:image = http://169.254.169.254/…`. |
| Timeout budget must be self-consistent | Total server budget **6s**. Page fetch **4s**, image HEAD probe **1.5s**, 0.5s buffer. Frontend cap **6.5s**. |
| `searchParams.delete('compose')` won't clean URL | Effect uses `setSearchParams(next, { replace: true })` and `useRef` one-shot guard so closing the modal doesn't reopen it. |
| Cache negative results too | Positive: 60 min. `no_image`: 20 min. `unsafe_url` / `invalid_content_type`: 60 min. `timeout` / `blocked`: NOT cached (transient). |
| Which entity route? | Effect added in all three: `EntityDetail.tsx`, `EntityV4.tsx`, `EntityDetailV2.tsx`. |
| Recommend shortcut | Dropped. |

## Access control

Unchanged. `useSearchToDraftEnabled()` still gates the Search tab. New endpoint uses the same admin-OR-(both-flags-ON) gate as `search-entity-candidates`.

## Flow (delta)

```text
Search results
├─ Already on CommonGroundz
│   • Cetaphil Gentle Skin Cleanser
│     [Write review]  [Open]                     ← NEW inline actions
└─ Suggested from the web
    • Cetaphil Gentle Skin Cleanser              ← image UNCHANGED at render time
      Product · Cetaphil · High
      cetaphil.com · Google Search  [Review & create]
                                        │
                                        ▼
              (spinner, up to 6.5s)  invoke enrich-candidate-image
                                        │
                                        ▼
              open AutoFillPreviewModal with imageCandidates
              (page_metadata image prepended if fetch succeeded;
               else Gemini image / placeholder — no toast on failure)
```

## Backend

### New: `supabase/functions/enrich-candidate-image/index.ts`

**Request:** `POST { sourceUrl: string, name: string }`

**Response:**
```ts
{
  imageUrl: string | null,
  source: "page_metadata" | null,
  method: "og" | "twitter" | "image_src" | "json_ld" | null,
  diagnostics: {
    latencyMs: number,
    fetched: boolean,      // true iff we hit the network this call
    cached: boolean,
    errorCode?:
      | "timeout" | "blocked" | "no_image"
      | "unsafe_url" | "invalid_content_type" | "rate_limited"
  }
}
```

**Gate order (STRICT):**
1. CORS preflight.
2. JWT → 401 on failure.
3. `has_role` → `isAdmin`. If not admin: require BOTH `isNonAdminEntityCreationEnabled()` AND `isNonAdminSearchToDraftEnabled()` → 403 `{ error: "search_disabled" }`.
4. Validate `sourceUrl` (`http(s)`, length 8–2048, parseable URL); `name` (length 1–200). Fail → 400 `invalid_input`.
5. Normalize `sourceUrl` (lowercase host, strip fragment, strip UTM/gclid/fbclid/msclkid) → cache key.
6. **Cache lookup.** Hit → return immediately with `cached: true`, `fetched: false`. Do NOT increment rate limit.
7. Cache miss → `increment_image_enrich_rate_limit(user_id)` → if > 60 return 429 `rate_limited`.
8. SSRF-safe fetch (see below). On any handled error, cache the terminal result per the negative-cache policy and return.

**SSRF-safe fetch (reuse `analyze-entity-url-v2/ssrf.ts` + `fetcher.ts` patterns):**
- Reuse `assertSafeUrl` from `../analyze-entity-url-v2/ssrf.ts` for both the initial `sourceUrl` AND every redirect target AND the extracted image URL.
- Timeouts: **total 6s budget** shared across preflight DNS, page fetch, HEAD probe.
  - Page fetch: `redirect: "manual"`, ≤3 hops, body cap 512 KB, `Accept: text/html`, generic UA, no cookies/auth. ~4s cap.
  - Image HEAD probe (only when extracted URL extension is ambiguous): ~1.5s cap.
- Reject non-`text/html` on page fetch → `errorCode: "no_image"`.
- Reject non-`image/*` on image HEAD → `errorCode: "invalid_content_type"`.
- Reject SSRF violation → `errorCode: "unsafe_url"`.
- Reject abort → `errorCode: "timeout"`.

**Extraction:** parse `<head>` for, in order: `og:image`, `og:image:secure_url`, `twitter:image`, `link[rel="image_src"]`, first JSON-LD `image` (string or `{url}`). Resolve to absolute URL against final page URL. Run through existing `isValidPageImageUrl` (from `supabase/functions/fetch-url-metadata-lite/image_validation.ts` — import directly if Deno allows cross-function import; otherwise copy the small pure function into this function's folder).

**Cache:** in-memory `Map<cacheKey, { result, expiresAt }>`, LRU cap 300.
- Positive (image found): 60 min TTL.
- `no_image`: 20 min TTL.
- `unsafe_url` / `invalid_content_type`: 60 min TTL.
- `timeout` / `blocked` / `rate_limited`: NOT cached.

**Logging:** `{ host, method, latencyMs, errorCode, cached }` only. Never log full URL, page HTML, query strings, tokens.

### DB migration

```sql
CREATE TABLE public.image_enrich_rate_limits (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_enrich_rate_limits TO service_role;
ALTER TABLE public.image_enrich_rate_limits ENABLE ROW LEVEL SECURITY;
-- service-role only; no user-facing policies.

CREATE OR REPLACE FUNCTION public.increment_image_enrich_rate_limit(_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_count int;
BEGIN
  INSERT INTO public.image_enrich_rate_limits (user_id, window_start, count)
  VALUES (_user_id, date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET count = image_enrich_rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_image_enrich_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_image_enrich_rate_limit(uuid) TO service_role;
```

No change to `set_app_flag`, existing flags, or `CandidateSource`.

## Frontend

### Edit: `src/components/admin/entity-create/SearchEntryPanel.tsx` (additive)

**Selected-candidate enrichment (deterministic, one-shot per click):**
1. On `Review & create`:
   - If `candidate.imageUrl` already present → call `onPick(payload)` immediately.
   - Else set per-card `isEnriching` state, disable other candidates' buttons.
2. `supabase.functions.invoke('enrich-candidate-image', { body: { sourceUrl, name } })` wrapped in a `Promise.race` with a **6.5s client timeout**.
3. On success with `imageUrl`: `payload = { ...payload, draft: mergeEnrichedImage(payload.draft, imageUrl, method) }`.
4. On any outcome (success / null / failure / timeout / 429): call `onPick(payload)` exactly once, clear `isEnriching`. No toast.
5. No auto-enrichment on card render. No background prefetch.

**Existing-match shortcuts:**
- Replace single `Open` with `[Write review]` (default variant) + `[Open]` (secondary).
- `Write review` → `navigate('/entity/' + slug + '?compose=review')` then close dialog.
- `Open` → `navigate('/entity/' + slug)` then close dialog (unchanged behavior).
- If unauthenticated: hide `Write review`; keep `Open`.

### Edit: `src/components/admin/entity-create/applyEntityDraft.ts`

Add pure helper:
```ts
export function mergeEnrichedImage(
  draft: EntityDraft,
  imageUrl: string,
  method: "og" | "twitter" | "image_src" | "json_ld",
): EntityDraft
```
Prepends an `ImageCandidate` with `source: "page_metadata"`, `confidence: 0.75`, `reason: "og:image from source page"` (or matching label for method). Idempotent — no-op if same URL already present.

### Edit: `src/pages/EntityDetail.tsx`, `src/components/entity-v4/EntityV4.tsx`, `src/pages/EntityDetailV2.tsx`

Same tiny `useEffect` added to each (they each own their own `isReviewFormOpen` + `ReviewForm`):

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const composeHandledRef = useRef(false);

useEffect(() => {
  if (composeHandledRef.current) return;
  if (searchParams.get('compose') !== 'review') return;
  if (!user || !entity) return;               // wait for auth + entity load
  composeHandledRef.current = true;
  setIsReviewFormOpen(true);
  const next = new URLSearchParams(searchParams);
  next.delete('compose');
  setSearchParams(next, { replace: true });
}, [searchParams, user, entity, setSearchParams]);
```

The `composeHandledRef` guard guarantees closing the modal doesn't reopen it.

### No changes to

`CreateEntityDialog.tsx`, feature-flag hooks, `useAppFlagsAdmin.ts`, contract files, URL flow, `analyze-entity-url*`, admin panel, `EntityV3` (only add effect if it also owns its own `ReviewForm` — verify in build step 0; if it delegates to V4/V2 it's covered).

## Files

**New (2)**
- `supabase/functions/enrich-candidate-image/index.ts`
- 1 DB migration (rate-limit table + RPC)

**Edited (5, all additive)**
- `src/components/admin/entity-create/SearchEntryPanel.tsx`
- `src/components/admin/entity-create/applyEntityDraft.ts`
- `src/pages/EntityDetail.tsx`
- `src/components/entity-v4/EntityV4.tsx`
- `src/pages/EntityDetailV2.tsx`

**Untouched:** everything else.

## Secrets
None.

## Build step 0 (before writing code)
1. `code--view supabase/functions/analyze-entity-url-v2/ssrf.ts` — confirm `assertSafeUrl` signature; confirm cross-function relative import works in Deno (Lovable deploys each function independently; if not, copy the pure module into the new function folder).
2. `code--view supabase/functions/fetch-url-metadata-lite/image_validation.ts` — same reuse check for `isValidPageImageUrl`.
3. `code--view src/components/entity-v4/EntityV4.tsx` — confirm `useSearchParams`, `user`, `entity`, and `setIsReviewFormOpen` are all available in scope where the effect will live; adjust otherwise.
4. Confirm `EntityV3` presence and whether it owns its own `ReviewForm` — if so, add the same effect there; if it delegates, skip.

## Success criteria
1. Web candidate WITHOUT image: clicking `Review & create` shows a spinner on that button; within ≤6.5s the AutoFillPreviewModal opens. If enrichment succeeded, the review image grid shows the fetched image first with `source = page_metadata`; otherwise it opens with Gemini/placeholder.
2. Web candidate WITH image: skips enrichment, opens instantly, no network call.
3. Enrichment failure / timeout / 429 / SSRF-block never blocks review from opening and shows no error toast.
4. Second click on the same normalized `sourceUrl` within TTL returns `diagnostics.cached: true` AND does not consume rate-limit quota (verified by unchanged `count` in `image_enrich_rate_limits`).
5. `search-entity-candidates` (20/hr) and `enrich-candidate-image` (60/hr) are fully independent buckets.
6. SSRF: endpoint rejects `sourceUrl` values of `http://127.0.0.1/…`, `http://localhost/…`, `http://169.254.169.254/…`, private-range IPv4 (10/8, 172.16/12, 192.168/16), IPv6 `::1` / `fc00::/7` / `fe80::/10`, and non-`http(s)` schemes with `errorCode: "unsafe_url"`.
7. SSRF also blocks the same values when they appear as the EXTRACTED `og:image` — endpoint returns `errorCode: "unsafe_url"` and does NOT return the image URL.
8. Non-image HEAD response → `errorCode: "invalid_content_type"`; non-`text/html` page response → `errorCode: "no_image"`.
9. Edge logs contain only `{ host, method, latencyMs, errorCode, cached }` — no full URLs, no HTML.
10. Existing-match card shows `[Write review] [Open]`. Clicking `Write review` navigates to `/entity/:slug?compose=review`, dialog closes, `ReviewForm` auto-opens on the entity page (regardless of whether V4/V3/V2 renders), and the URL updates to `/entity/:slug` (compose param removed) via `replace`.
11. Closing the `ReviewForm` on the entity page does NOT reopen it (one-shot guard works).
12. `Open` behavior unchanged.
13. Unauthenticated user does not see `Write review` on existing-match cards.
14. URL tab, admin flags panel, `analyze-entity-url*` behavior unchanged.

## Out of scope for 3.5b
- `Recommend` shortcut.
- Any auto-enrichment of visible candidate cards.
- Rendering Google `searchEntryPoint` widget (compliance-gated).
- Type-specific boosters (Books/OMDb/Places/OFF).
- Candidate ranking/dedupe polish (defer to 3.5c if needed).
- Barcode (3.7), image upload (3.6).
- Any URL-flow change.
