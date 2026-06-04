
# Version 2 Entity URL Extraction — Final Reference Plan

> Single source of truth. Cross-check during implementation. Phases are sequential; ship Phase 1 only after approval.

---

## 1. Current architecture summary

### What exists today
- **Edge function** `supabase/functions/analyze-entity-url/index.ts`
  - Admin-gated (`Authorization: Bearer <JWT>` → `auth.getClaims` → `has_role(user, 'admin')`).
  - Calls Gemini 2.5 Flash with `tools: [{ googleSearch: {} }]` only. URL Context is **not actually attached** despite the `method: 'url_context_grounding'` label.
  - Parses JSON from `candidates[0].content.parts[0].text` via regex / code-fence stripping.
  - Matches `suggested_category` against `public.categories` using a best-segment scoring algorithm.
  - Returns `{ success, predictions, metadata }`.
- **Prompt** built dynamically from `entity-config.ts` via `prompt-generator.ts` (shared schema source of truth).
- **Adjacent functions** used by the Create flow: `enrich-brand-data`, `create-brand-entity`, `fetch-url-metadata-lite`. Brand auto-creation may occur during the Save path in `CreateEntityDialog`.
- **Single Analyze caller**: `src/components/admin/CreateEntityDialog.tsx`. All entry points funnel through it:
  - `src/pages/Explore.tsx`
  - `src/pages/Search.tsx`
  - `src/components/feed/UnifiedEntitySelector.tsx` (post composer)
  - `src/components/admin/AdminEntityManagementPanel.tsx`
- **Admin flag plumbing**: `AdminFeatureFlagsPanel.tsx`, `useAppFlagsAdmin.ts`, RPC `set_app_flag`, table `public.app_config`, public read RPC `get_public_flags`.

### What must NOT be touched (non-negotiable)
- `analyze-entity-url/index.ts`, its `prompt-generator.ts`, its `entity-config.ts`.
- `enrich-brand-data`, `create-brand-entity`, `fetch-url-metadata-lite`.
- V1 brand auto-creation path on Save.
- V1 admin gating.
- Existing response shape consumed by `CreateEntityDialog` preview (additive fields only).

---

## 2. Proposed Version 2 architecture

### High-level flow
```text
Admin pastes URL in CreateEntityDialog
   │
   ▼
useAnalyzeUrlEngine() reads entity_extraction.version from app_config
   │   (admin-only; default 'v1')
   │
   ├── v1 → invoke('analyze-entity-url')         [UNCHANGED]
   │
   └── v2 → invoke('analyze-entity-url-v2')
            │ 1. CORS + Zod body validation + admin auth
            │ 2. SSRF guard (scheme, host, IP ranges, redirects, size, timeout)
            │ 3. Direct HTML fetch (graceful on failure → warnings[])
            │      parse title/meta/canonical/favicon, OG, Twitter,
            │      JSON-LD (Product/Book/Movie/Place/...)
            │ 4. Weak-signal detector
            │ 5. Firecrawl fallback (ONLY when triggers fire — see L)
            │ 6. Gemini 2.5 Flash with tools:[urlContext, googleSearch]
            │      EXTRACTED_EVIDENCE injected as PRIMARY source
            │      responseSchema preferred; JSON-mode fallback only on
            │      clear schema/tool compatibility errors
            │ 7. Normalize → CG schema + per-field confidence
            │ 8. Category match (algorithm copied into v2 folder)
            │ 9. Brand suggestion (LOOKUP ONLY — never writes)
            │ 10. Return predictions + additive metadata
   │
   ▼
Existing preview modal → admin edits → Save → existing create path
       (brands may be created HERE on Save after confirmation, never during Analyze)
```

### Edge functions involved
- New: `analyze-entity-url-v2` (sibling folder, isolated).
- Untouched: `analyze-entity-url`, `enrich-brand-data`, `create-brand-entity`, `fetch-url-metadata-lite`.

### Tools/APIs involved
- Server-side `fetch` for direct HTML (behind SSRF guard).
- Gemini REST: `model: gemini-2.5-flash`, `tools: [{ urlContext: {} }, { googleSearch: {} }]`.
- Firecrawl REST v2 (`FIRECRAWL_API_KEY`, via connector).
- Supabase `public.categories`, `public.entities` (read-only lookups).

### Data flow contract
- Inbound: `{ url: string }`.
- Outbound: V1's `predictions` shape **plus** additive fields (`field_confidence`, `image_candidates`, `extraction_sources`, `warnings`, `brand_suggestion`).
- No DB mutations during V2 Analyze. Logging table (Phase 11) is the only write, and it is deferred.

---

## 3. Phase-by-phase implementation plan

> Phase order intentionally follows the safer sequence:
> 1) selector/config → 2) v2 skeleton → 3) routing.
> This guarantees the app never routes to a missing V2 function.

---

### Phase 1 — Engine selector (config + admin UI)

**Goal**: Add a globally readable, admin-controlled flag for `v1` (default) or `v2`. No behavior change yet.

**Files/functions to touch**
- `src/hooks/admin/useAppFlagsAdmin.ts` — extend allowed-keys union and the row `IN (...)` filter to include `entity_extraction.version`.
- `src/components/admin/AdminFeatureFlagsPanel.tsx` — add a new card "Entity URL extraction engine" with a radio/select:
  - **Version 1 — Stable**
  - **Version 2 — Experimental**
  - Reuse the existing AlertDialog "Reason for change" pattern.
- New `src/hooks/useAnalyzeUrlEngine.ts` — returns `'v1' | 'v2'`. Reads the row directly via a small admin-only select. **Forces `'v1'` for non-admins.** Defaults to `'v1'`.

**Database/RPC changes**
- No new table. Reuse `public.app_config` + `set_app_flag`.
- Whitelist new key `entity_extraction.version` (default value `{ "version": "v1" }`) — surfaced through the admin allow-list, not added to `get_public_flags`.

**Edge function changes**: None.

**Expected behavior**: Admin can flip between v1 and v2 with a reason; selection persists. App behavior unchanged.

**Testing checklist**
- Admin flips flag → row updates, reason logged.
- Non-admin: `useAnalyzeUrlEngine()` returns `'v1'`.
- Default after migration is `'v1'`.
- Page reload preserves selection.

**Risks / rollback**: Purely additive. Rollback = set value to `'v1'`.

---

### Phase 2 — Create `analyze-entity-url-v2` skeleton

**Goal**: Deployable, admin-gated stub mirroring V1's response shape — **before** routing wires up.

**New files**
- `supabase/functions/analyze-entity-url-v2/index.ts`
  - CORS.
  - Zod body schema `{ url: z.string().url().max(2048) }`.
  - Admin auth (same pattern as V1: `getClaims` → `has_role`).
  - Returns:
    ```jsonc
    {
      "success": true,
      "predictions": null,
      "metadata": {
        "extraction_version": "v2",
        "edge_function": "analyze-entity-url-v2",
        "method": "stub",
        "timestamp": "...",
        "used_url_context": false,
        "used_google_search": false,
        "used_firecrawl": false
      },
      "warnings": ["stub: extraction not yet implemented"]
    }
    ```
- `supabase/functions/analyze-entity-url-v2/schema.ts` — Zod schemas (body, evidence, response).
- `supabase/functions/analyze-entity-url-v2/ssrf.ts` — placeholder, filled in Phase 4.

**DB/RPC changes**: None.

**Frontend changes**: None.

**Expected behavior**: Function deployable and reachable, but nothing calls it yet.

**Testing checklist**
- Curl with admin JWT → 200 stub.
- Curl without JWT → 401.
- Curl with non-admin JWT → 403.
- Metadata fields present and correctly typed.

**Risks / rollback**: Delete folder.

---

### Phase 3 — Centralized version routing in `CreateEntityDialog`

**Goal**: Single decision point selects v1 or v2; v2 is now safely reachable.

**Files/functions to touch**
- `src/components/admin/CreateEntityDialog.tsx`
  - Replace the direct `invoke('analyze-entity-url', …)` with:
    ```ts
    const engine = useAnalyzeUrlEngine();
    const fnName = engine === 'v2' ? 'analyze-entity-url-v2' : 'analyze-entity-url';
    console.log('[Analyze] engine=', engine, 'fn=', fnName);
    const aiResult = await supabase.functions.invoke(fnName, { body: { url: analyzeUrl } });
    ```
  - **Admin-only Analyze UI**: confirm/ensure the Analyze URL section renders only when `useIsAdmin()` is true. If non-admins can open the dialog, hide Analyze entirely; show only manual creation. **No silent 403.**

**No silent fallback policy**
- If `engine === 'v2'` and the call returns an error / `success: false`, surface a clear admin toast + inline message:
  > "Version 2 extraction failed. Switch to Version 1 in Admin → Feature Flags, or retry."
- Do **not** automatically retry against v1. (A manual "Retry with V1" button is planned for a later phase.)

**DB/RPC changes**: None.

**Edge function changes**: None.

**Expected behavior**:
- v1 selected → behavior identical to today across all 4 entry points.
- v2 selected → V2 skeleton response renders or shows the explicit error toast.
- Non-admin in dialog: Analyze section is invisible.

**Testing checklist**
- v1 flag → Network tab shows `analyze-entity-url`.
- v2 flag → Network tab shows `analyze-entity-url-v2`; no v1 call.
- v2 failure → admin error toast; v1 is **not** called silently.
- All 4 entry points exercise the same routing.

**Risks / rollback**: Revert single dialog file; v1 path is untouched.

---

### Phase 4 — SSRF + safety layer (V2 only)

**Goal**: Hardened URL validation before any outbound fetch / AI / Firecrawl call.

**Edge function changes**
- `ssrf.ts` implements `validateAndFetchUrl(url, opts)`:
  - Only `http:` / `https:`.
  - URL length ≤ 2048.
  - Reject `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, link-local `169.254.0.0/16`, IPv6 link-local `fe80::/10`, RFC 1918 (`10/8`, `172.16/12`, `192.168/16`), ULA `fc00::/7`.
  - Resolve DNS and re-check the resolved IP against the same blocklist (defends DNS rebinding).
  - Request timeout (default 8 s).
  - Max response size enforced while streaming (default 2 MB).
  - Follow ≤ 3 redirects; re-validate each hop's URL + resolved IP.
  - Content-Type allow-list: `text/html`, `application/xhtml+xml` (others rejected with warning).
- `index.ts` calls the guard before any outbound network access.

**Expected behavior**: Invalid/private URLs return clean 400; valid public URLs flow on.

**Testing checklist**
- Reject `http://localhost`, `http://127.0.0.1`, `http://10.0.0.1`, `http://169.254.169.254` (cloud metadata).
- Reject a public URL that 302-redirects to a private IP.
- Accept `https://www.wikipedia.org`.
- Oversized response triggers size warning, not crash.

**Risks / rollback**: Guard is internal to v2; rollback = remove the guard call.

---

### Phase 5 — Exact-page extractor

**Goal**: Deterministic, high-confidence evidence from the page itself, **before** any AI.

**New file**: `supabase/functions/analyze-entity-url-v2/extract-page.ts`
- Uses the SSRF-safe fetcher.
- Parses with `deno-dom` (regex fallback acceptable). Extracts:
  - `<title>`, `<meta name="description">`, `<link rel="canonical">`, favicon.
  - OG: `og:title`, `og:description`, `og:image`, `og:site_name`, `og:type`.
  - Twitter: `twitter:title`, `twitter:description`, `twitter:image`.
  - All `<script type="application/ld+json">`; flatten `@graph`; detect `Product`, `Book`, `Movie`, `TVSeries`, `Restaurant`, `Place`, `SoftwareApplication`, `Course`, `VideoGame`, `Recipe` → map to CG types.
  - From `Product`: name, `brand.name`, `image[]`, `offers.price`, `offers.priceCurrency`, `offers.availability`, `sku`, `aggregateRating`.
- Returns `ExtractedEvidence { url, canonical, title, description, ogImage, twitterImage, jsonLd, images: Candidate[], hints, warnings[] }`.

**Graceful failure behavior (per H)**
- If fetch is blocked (4xx/5xx/timeout/empty body), do **not** abort.
- Push the upstream status into `warnings`, return a partial evidence object with empty `images/jsonLd`, and let the pipeline continue.
- Fetch failure ≠ extraction failure.

**Expected behavior**: Static pages yield rich evidence; hostile e-commerce sites yield empty evidence with populated warnings — pipeline still continues.

**Testing checklist**
- Fixtures: Amazon-style Product JSON-LD, Wikipedia article, plain blog, JS-shell page, 403-blocking host.
- Verify `ExtractedEvidence` shape for each.
- Verify `warnings` includes the upstream HTTP status on failure.

**Risks / rollback**: Pure addition; isolated module.

---

### Phase 6 — Weak-signal detector + Firecrawl fallback

**Goal**: Use Firecrawl **only** when exact extraction or URL Context can't deliver. Never default-on.

**Detector** (`detectWeakSignals(evidence) → { weak: boolean, missing: string[], reasons: string[] }`)
- `exactExtractionWeak` if **any**:
  - No JSON-LD `Product`/typed schema AND no `og:image`.
  - Body text < 500 chars.
  - Only generic title (matches `og:site_name`) with no description.
  - No image candidates ≥ 300 px.
  - Exact-fetch failed (HTTP error / empty body).
- `criticalFieldsMissing` if any of `name`, `image`, `brand` missing after exact extraction.
- `knownJsHeavyHost` matches: `amazon.*`, `flipkart.com`, `myntra.com`, `nykaa.com`, `ajio.com`, `meesho.com` (editable list).

**Firecrawl trigger rule (per L — clear, non-tautological)**
```ts
shouldUseFirecrawl =
     exactExtractionWeak
  || criticalFieldsMissing
  || urlContextFailed        // set in Phase 7 if Gemini's urlContext returns no urlRetrievalStatus.SUCCESS
  || lowConfidence;          // set in Phase 8 after a first normalization pass

// known JS-heavy host is a SIGNAL/PRIORITY BOOSTER, not a trigger by itself:
firecrawlPriority = shouldUseFirecrawl && knownJsHeavyHost ? 'high' : 'normal';
```
Known JS-heavy host alone never triggers Firecrawl.

**New file**: `supabase/functions/analyze-entity-url-v2/firecrawl.ts`
- Server-side; reads `Deno.env.get('FIRECRAWL_API_KEY')`.
- Calls Firecrawl `/v2/scrape` with `formats: ['markdown','html', { type:'json', schema: productLikeSchema }, 'screenshot']`, `onlyMainContent: true`, `waitFor: 1500`, request timeout 12 s.
- Merges into `ExtractedEvidence`; every Firecrawl field tagged `source: 'firecrawl'`. Output is passed through the **same Gemini/schema normalization step** (Phase 7) — not blindly trusted.
- On error/timeout: push to `warnings`, set `used_firecrawl: false`, continue. Handle 402/insufficient credits gracefully (clear admin message).

**Cost / latency controls**
- Hard 12 s timeout.
- Skip Firecrawl entirely when exact extraction is already strong.
- Metadata `used_firecrawl` reflects reality.

**Testing checklist**
- Wikipedia URL → `used_firecrawl: false`.
- Amazon URL with empty exact extraction → `used_firecrawl: true`, evidence populated.
- Amazon URL with rich JSON-LD → `used_firecrawl: false`.
- Firecrawl 5xx → warning added, pipeline continues.
- Firecrawl 402 → clear admin-friendly message.

**Risks / rollback**
- Cost spike → tune detector thresholds; short-circuit by disabling helper.
- Credit exhaustion → handled per firecrawl knowledge.

---

### Phase 7 — Gemini call with true URL Context + structured output

**Goal**: Gemini normalizes + fills gaps. Not the primary extractor.

**Request body**
```jsonc
{
  "contents": [{ "role": "user", "parts": [{ "text": userPrompt }] }],
  "systemInstruction": { "role": "system", "parts": [{ "text": v2SystemPrompt }] },
  "tools": [{ "urlContext": {} }, { "googleSearch": {} }],
  "generationConfig": {
    "temperature": 0.15,
    "responseMimeType": "application/json",
    "responseSchema": v2ResponseSchema
  }
}
```

**Prompt rules**
- `userPrompt` contains the URL **and** a JSON-serialized `ExtractedEvidence` block.
- Instruction text (paraphrased):
  > "Treat EXTRACTED_EVIDENCE as ground truth. Use URL Context to read the page. Use Google Search only to confirm or fill missing public facts. Do not invent fields. For each field return a confidence 0–1."
- `v2SystemPrompt`: built by `prompt-generator-v2.ts` in the v2 folder. It **imports** the existing shared `entity-config` (or keeps a verbatim copy in the v2 folder if the Deno import path is awkward). **V1 files are not modified.**
- Capture `groundingMetadata.urlContextMetadata` and `groundingMetadata.groundingChunks` from the response → set `metadata.used_url_context` and `metadata.used_google_search` from real evidence, not a hardcoded label. Set `urlContextFailed = true` when no `URL_RETRIEVAL_STATUS_SUCCESS` is present, so the Phase 6 detector can re-trigger Firecrawl if needed.

**`responseSchema` compatibility (per J)**
- Preferred: `responseSchema` + `responseMimeType: application/json`.
- Fallback to JSON-mode + manual parser **only** on clear schema/tool-compat errors (e.g., 400 mentioning `responseSchema`/`tools` incompatibility). Generic Gemini errors (5xx, timeouts, content-policy) propagate as-is and trigger the no-silent-fallback admin error.

**Testing checklist**
- Wikipedia URL: `used_url_context: true`.
- Blocked page: Gemini still produces useful fields from URL Context.
- `used_url_context` accurately reflects grounding metadata.
- Forced schema-compat error → automatic JSON-mode fallback works and is logged.

**Risks / rollback**
- SDK/API incompatibility → JSON-mode fallback.
- Gemini latency spike → ~20 s timeout; partial results + warnings.

---

### Phase 8 — Normalization, confidence, category, brand suggestion

**Goal**: Produce a V1-compatible payload with additive fields and **zero DB writes**.

**Merge order (highest → lowest confidence)**
1. JSON-LD Product / typed schema
2. OG metadata
3. Twitter metadata
4. Firecrawl structured JSON (if invoked)
5. Gemini-derived fields

**Output `predictions`** (V1-compatible keys)
```ts
{
  type, name, description,
  category_id, suggested_category_path, matched_category_name,
  tags, confidence, reasoning,
  additional_data,
  image_url, images
}
```

**Additive fields** (ignored by current UI; consumed by future UI / Compare mode)
```ts
{
  field_confidence: Record<string, number>,
  image_candidates: Array<{ url, source, confidence, label }>,
  extraction_sources: string[],
  warnings: string[],
  brand_suggestion: {
    name: string,
    matched_entity_id: string | null,
    source: 'jsonld' | 'og' | 'firecrawl' | 'gemini',
    confidence: number
  } | null
}
```

**Image candidate priority** (per M): JSON-LD Product image → OG → Twitter → Firecrawl rendered → script-embedded arrays → official brand/product page → Google Custom Search fallback (future) → Gemini-suggested. UI keeps single `image_url` for now.

**Category matching**: copy V1's algorithm verbatim into `v2/categoryMatch.ts`. Same `public.categories` query.

**Brand suggestion (per N)**
- Read-only fuzzy lookup against `public.entities WHERE type='brand'`.
- **Never** calls `create-brand-entity`.
- Returns `brand_suggestion` (or `null`).

**Integration with existing parent_id flow on Save**
- V2 returns `brand_suggestion` plus, when matched, `predictions.additional_data.brand_entity_id`.
- The existing `CreateEntityDialog` Save handler continues to:
  - If admin accepts a **matched** brand → use that `parent_id` (no new write).
  - If admin accepts an **unmatched** suggestion → call existing `create-brand-entity` **on Save**, then set `parent_id` (V1's current behavior).
  - If admin **does not confirm** the brand suggestion → no brand created. Weak suggestions are never silently materialized.
- Net result: brand creation moves out of Analyze, into Save, only after explicit admin confirmation. V1 path remains untouched.

**Testing checklist**
- Snapshot test: V2 response keys ⊇ V1 response keys.
- Product with known brand → `brand_suggestion.matched_entity_id` set.
- Product with unknown brand → `matched_entity_id: null`.
- No `entities` rows inserted during Analyze (DB log check).
- On Save, brand is created only when admin explicitly accepts.

**Risks / rollback**
- Schema drift V1↔V2 → snapshot test guards.
- Category mis-match → tunable thresholds.

---

### Phase 9 — End-to-end admin smoke test

**Goal**: Validate V2 across all entry points.

**Checks**
- Flip `entity_extraction.version = 'v2'`.
- Open Analyze from: Explore, Search, UnifiedEntitySelector (post composer), AdminEntityManagementPanel.
- URL matrix: blog, Wikipedia, Amazon product, Flipkart product, Myntra product, YouTube video, IMDb title, Goodreads book, restaurant page, news article.
- Verify metadata fields (`extraction_version`, `used_*`) reflect reality.
- Verify V1 path is unchanged when flipped back.
- Verify V2 failure produces the admin-facing error (no silent v1 call).

**Risks / rollback**: Flip flag back to `'v1'` instantly.

---

### Phase 10 — Extraction logging (DEFERRED; V2-only by default)

**Goal**: Persist V2 runs for admin analysis.

**Migration**: new table `public.entity_extraction_runs`
- Fields: `id, user_id, source_url, extraction_version, edge_function, success, predicted_name, predicted_type, predicted_brand, image_count, confidence, field_confidence jsonb, duration_ms, used_url_context, used_firecrawl, used_google_search, error_message, raw_response jsonb, created_at`.
- Grants: `service_role` for all (edge fn writes); admin `SELECT` via RLS using `public.has_role(auth.uid(),'admin')`. **No** `anon`/`authenticated` grants.
- RLS enabled.

**Edge fn changes**: V2 performs a best-effort INSERT after responding (or fire-and-forget). Failure never blocks the response. **V1 stays untouched** (V1 logging is a separate later discussion).

**Frontend**: New admin tab "Extraction Runs" with filters by version + URL search.

**Risks / rollback**: Drop table; remove insert call.

---

### Phase 11 — Compare mode (DEFERRED)

**Goal**: Admin-only side-by-side V1 vs V2 for the same URL.

**Files**
- New `src/components/admin/AdminAnalyzeCompareDialog.tsx` reachable only from Admin Portal.
- Calls both edge functions in parallel via `Promise.allSettled`.
- Renders columns: name, type, brand, description, category, main image, image candidates, confidence, time taken, errors/warnings.

**Risks / rollback**: Isolated dialog; remove.

---

## 4. Final target flow

```text
Admin pastes URL
   → useAnalyzeUrlEngine() (admin-only; default v1)
   → analyze-entity-url-v2 (when engine = v2)
       → Zod validation + admin auth
       → SSRF guard
       → Direct exact-page fetch (graceful on failure → warnings)
       → Weak-signal detector
       → (conditional) Firecrawl fallback
       → Gemini 2.5 Flash with urlContext + googleSearch (evidence injected)
       → Normalize + per-field confidence + category match + brand suggestion (lookup only)
   → Existing preview modal (renders V1-compatible predictions; ignores additive fields for now)
   → Admin edits / accepts
   → Save/Create → existing entity-creation path
       (brand entity may be created HERE on Save, only after admin confirms a suggestion)
```

---

## 5. Questions / assumptions to confirm before Phase 2

1. **Gemini `responseSchema` + `urlContext` + `googleSearch` compatibility** — preferred path is `responseSchema`. Confirm we should auto-fallback to JSON-mode on schema/tool-compat errors only, and propagate all other Gemini errors as the no-silent-fallback admin error (current assumption).
2. **Firecrawl connector** — assumed `FIRECRAWL_API_KEY` is already linked at workspace level. If not, Phase 6 needs a preceding `standard_connectors--connect` step.
3. **Flag visibility** — `entity_extraction.version` will **not** be added to `get_public_flags`. Non-admin clients never read it; `useAnalyzeUrlEngine` returns `'v1'` for them. Confirm.
4. **Admin-only Analyze in the dialog** — confirm we should **hide** the Analyze URL section entirely for non-admins (no greyed-out button) and show only manual entry. (Plan assumes yes.)
5. **Logging** — default assumption is V2-only logging to preserve "V1 untouched". Confirm before Phase 10.
6. **Compare mode placement** — Admin Portal new tab (plan assumes this), or surfaced inside `AdminFeatureFlagsPanel`?
7. **Brand `parent_id` on Save** — confirm V1's Save handler already creates a brand on demand via `create-brand-entity`. If not, V2's Save flow needs a small additive change in `CreateEntityDialog` only (not in any edge function). I will verify before Phase 8 implementation.

---

Once you approve this reference plan, we will implement **Phase 1 only** and stop for review.
