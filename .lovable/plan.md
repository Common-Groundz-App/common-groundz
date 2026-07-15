## Fix plan — Phase 3.5 operational completion

Confirmed from the screenshot: `supabase/functions/search-entity-candidates/index.ts:38` currently says `const DEFAULT_GEMINI_GROUNDED_MODEL = "gemini-1.5-flash";`. Codex is right. All seven items below will be applied.

### 1. Switch grounded-search model to `gemini-3.5-flash`
- In `supabase/functions/search-entity-candidates/index.ts`:
  - Change `DEFAULT_GEMINI_GROUNDED_MODEL` from `"gemini-1.5-flash"` to `"gemini-3.5-flash"`.
  - Update the header comment block so it references `gemini-3.5-flash` and `google_search` (not the legacy `google_search_retrieval`).
  - Confirm the request body already uses `tools: [{ google_search: {} }]`. If any code path still emits `google_search_retrieval`, remove it — 3.5 requires `google_search`.

### 2. Reduce timeout after model switch
- In the same file, change the default `GEMINI_TIMEOUT_MS` fallback from `30_000` to `12_000`.
- Keep the `Deno.env.get("GEMINI_TIMEOUT_MS")` override so it can be tuned without a redeploy.
- On abort, keep returning `diagnostics.errorCode = "timeout"` and preserve any `existingMatches` already gathered.

### 3. Check & clear stale env override
- Inspect the deployed `GEMINI_GROUNDED_MODEL` secret. If it is pinned to `gemini-1.5-flash`, remove it so the code default (`gemini-3.5-flash`) applies. If unset, leave it unset.
- Same check for `GEMINI_TIMEOUT_MS` — if pinned above 12000, unset it.

### 4. Redeploy the three edge functions
- Deploy `search-entity-candidates` (picks up model + timeout change).
- Deploy `log-search-funnel` (currently 404).
- Deploy `enrich-candidate-image` (currently 404).
- Verify each with a direct call: no 404, and `search-entity-candidates` diagnostics return `model: "gemini-3.5-flash"`.

### 5. Wire Search-to-Draft citation URL into duplicate check
- In `src/components/admin/CreateEntityDialog.tsx`, at the pre-insert `check-entity-duplicates` call:
  - Compute `const fromSearch = Boolean(aiPredictions?.__fromSearch);`
  - Compute `const searchSourceUrl = fromSearch ? (aiPredictions?.searchSourceUrl ?? aiPredictions?.metadata?.search_source_url ?? null) : null;`
  - Extend the request body: `{ name, type, parentId, websiteUrl, sourceUrl: searchSourceUrl }`.
  - Do NOT copy `searchSourceUrl` into `website_url` (keeps the existing invariant).
- Leave the URL-analyze path unchanged; it already passes its own `sourceUrl`.

### 6. Front-end fallback copy on grounded timeout
- In `SearchEntryPanel.tsx`, when `diagnostics?.errorCode === "timeout"`:
  - If there are local `existingMatches`, keep the existing partial-fail message.
  - If there are no local matches, show: "Web suggestions are temporarily unavailable. Try again."
- No spinner or layout change beyond the message swap.

### 7. Verify live DB objects
- Query the live DB to confirm existence of: `search_funnel_events`, `image_enrich_rate_limits`, function `increment_image_enrich_rate_limit(uuid)`, and app flag `search_to_draft.non_admin_enabled`.
- Verify RLS is enabled on `search_funnel_events`, no user-facing INSERT policy exists, and admins can `SELECT`. If anything is missing, add it via a migration (the tables were created in Phase 3.5c, so this should be a no-op).

### What is intentionally NOT changed
- No changes to dedup logic, `pendingDuplicateOriginRef`, recent-chip hook, `creation_source='search'` metadata stamping, or the funnel client hook — those already match the approved Phase 3.5c plan.
- No transport switch to Lovable AI Gateway. Codex's evidence (Google docs listing `gemini-3.5-flash` for `google_search` grounding) means the direct REST call should work once the model string and timeout are corrected. If after redeploy diagnostics still show timeouts/HTTP errors, we will revisit transport as a follow-up — not preemptively.

## Manual test plan (run after fixes ship)

**Phase 3.5a — Search-to-Draft**
- A. Search "cetaphil gentle cleanser" → completes in ≤12s, `diagnostics.model = "gemini-3.5-flash"`, web candidates shown, variants preserved, duplicates collapsed.
- B. Search a known-existing name → "Already on CommonGroundz" first; Open and Write review work.

**Phase 3.5b — Image enrichment**
- C. Pick candidate without image → Review & create → draft opens either way; if `og:image` exists it appears with source `page_metadata`; no error toast on failure.
- D. Direct-invoke `enrich-candidate-image` → non-404; unsafe URLs blocked; cache hits don't consume quota; logs contain only host/method/latency/errorCode.

**Phase 3.5c — Duplicate guard, attribution, recents, telemetry**
- E. Search-origin duplicate → `DuplicateConfirmDialog` appears; "Use this" → `/entity/:slug?compose=review`; "It's different — continue" creates; no double-dialog.
- F. New search-created entity metadata → `creation_source='search'`, `search_source_url` present, `created_from_url` absent, `website_url` not filled by citation.
- G. Recent-chip → appears after a search; click re-runs; no raw text in telemetry.
- H. As admin, verify `search_funnel_events` rows: `search_run`, `candidate_pick`, `review_opened`, `entity_created`; only `query_hash`; users cannot INSERT directly.

## Success criteria
- Web suggestions consistently return within ~12s for common queries, with `diagnostics.model = "gemini-3.5-flash"`.
- `log-search-funnel` and `enrich-candidate-image` return non-404 on direct calls.
- Search-origin duplicate checks now also match on citation URL.
- URL-analyze and manual creation flows are unchanged.