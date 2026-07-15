# Phase 3.5c (final) — Search Quality, Duplicate Guard Reuse, Funnel Signal

Approved scope from both reviewers, with two codex-suggested corrections folded in.

Verified in repo:
- `check-entity-duplicates`, `DuplicateConfirmDialog`, `useRecentSearches`, `useSearchToDraftEnabled`, `applyEntityDraft.__fromSearch = true` all exist.
- `CreateEntityDialog.tsx` is at `src/components/admin/CreateEntityDialog.tsx`.
- Line 1975 currently does `const creationSource = overrides?._fromDraftFlow ? 'url' : 'manual'` — search-origin creations are mislabeled as `url` today. Fix in this phase.
- No `__fromSearch` submit-override flag exists; only `aiPredictions.__fromSearch` on the current draft.

---

## 1. Conservative candidate dedup (`search-entity-candidates`)

Post-processing after Gemini, before caching/response.

Collapse only when strongly duplicate:
- Same `normalizeFullUrl(sourceUrl)` (host + path, query/fragment stripped).
- Same `normalizeBrandName(brand)` + same normalized name + same normalized variant.
- Same `normalizeBrandName(brand)` + exact-equal normalized name, only when both sides have no variant.

Never collapse when: variants differ, brand missing on one side, or names differ beyond punctuation/casing/whitespace.

Merge behavior: keep highest-confidence winner; merge `groundingSources` domains; keep winner's imageUrl. Cap at existing 5. Cache stores deduped list. Uses `_shared/brand_normalize.ts`. No client-contract change.

## 2. Reuse existing `check-entity-duplicates` — no new function

Do not create a second edge function. Do not add a second pre-insert check. Ensure the search draft flowing into `CreateEntityDialog.handleSubmit` populates the fields the existing check reads: `name`, `type`, `parentId` (resolved brand id if available), `sourceUrl` (search citation), `apiSource`/`apiRef` = null.

### Narrow duplicate-dialog routing override (search-origin only)

Since no `__fromSearch` submit flag exists, add a scoped ref alongside `pendingSubmitOverridesRef`:

```ts
const pendingDuplicateOriginRef = useRef<'search' | 'other'>('other');
```

- When opening the duplicate dialog, set:
  `pendingDuplicateOriginRef.current = aiPredictions?.__fromSearch ? 'search' : 'other';`
- `DuplicateConfirmDialog.onUseExisting`:
  - if origin === `'search'` → navigate to `/entity/${c.slug || c.id}?compose=review` (Phase 3.5b handler picks it up).
  - else → existing behavior unchanged.
- `onContinueNew` unchanged — still calls `handleSubmit({ ...prev, _duplicateConfirmed: true, _fromDraftFlow: prefilledFromDraftRef.current })`.
- Reset the ref after dialog close (both branches).

No changes to `DuplicateConfirmDialog.tsx` itself, no changes to URL/manual duplicate behavior.

## 3. Fix `creation_source` stamping for Search-to-Draft

Currently (line ~1975):
```ts
const creationSource = overrides?._fromDraftFlow ? 'url' : 'manual';
```

Change to:
```ts
const fromSearch = Boolean(aiPredictions?.__fromSearch);
const creationSource = fromSearch
  ? 'search'
  : overrides?._fromDraftFlow ? 'url' : 'manual';
```

And guard the `created_from_url` stamp so it only fires for the URL-analyze path:
```ts
if (!fromSearch && overrides?._fromDraftFlow && (analyzeUrl || lastAppliedUrl)) {
  telemetryStamp.created_from_url = analyzeUrl || lastAppliedUrl;
}
```

For search-origin creations, if a citation URL is available on the draft, store it as `metadata.search_source_url` instead. Never write the search citation into `website_url`. Never write it into `created_from_url`.

## 4. Recent search chips — reuse `useRecentSearches`

In `SearchEntryPanel.tsx`:
- `const { recents, addRecent, removeRecent, clearRecents } = useRecentSearches('entity-create-search');`
- `addRecent(query, 'query')` on successful search (results returned, not on error/empty-network).
- Render chips when input is empty and no results are shown. Clicking a chip re-runs that query.
- No new storage key. Recents are display-only; never sent to telemetry.

## 5. Funnel telemetry — edge-function-only writes

**Edge function** `supabase/functions/log-search-funnel/index.ts`:
- `POST { event, queryHash?, entityType?, candidateIndex?, source, diagnostics? }`.
- Auth required (JWT validated); writes via service role.
- `event` ∈ `{ search_run, candidate_pick, review_opened, entity_created }` — strict enum.
- `source` ∈ `{ search, existing_match }`.
- Rejects any payload with keys `query`, `q`, `raw`, `text`, `prompt` → 400.
- `diagnostics` allow-list: `latencyMs: number`, `cached: boolean`, `hasImage: boolean`. All other keys dropped server-side.
- Best-effort in-memory rate limit 300/hr per user (mirrors existing pattern). No new rate-limit table.
- Function logs contain only `{ event, entityType, cached, latencyMs }`. Never queryHash, headers, or body.

**Migration** `search_funnel_events`:
```text
id uuid pk default gen_random_uuid()
user_id uuid not null references auth.users on delete cascade
event text not null check in ('search_run','candidate_pick','review_opened','entity_created')
query_hash text nullable        -- SHA-256 hex
entity_type text nullable
candidate_index int nullable
source text not null check in ('search','existing_match')
diagnostics jsonb not null default '{}'
created_at timestamptz not null default now()
```
- RLS enabled.
- Policy: admins (`has_role`) can SELECT.
- No user INSERT policy (writes go through service role in the edge function).
- Grants: `SELECT` to `authenticated` (RLS restricts to admins), `ALL` to `service_role`. No `anon`, no `INSERT` to `authenticated`.
- Indexes: `(created_at desc)` and `(event, created_at desc)`.
- Enable `pg_trgm` only if not already present (already used by `match_entities_by_name`, likely present).

**Client hook** `src/hooks/useSearchFunnel.ts`:
- SHA-256 of `normalize(query)` via `crypto.subtle`.
- Never logs raw query.
- Fire-and-forget `supabase.functions.invoke` with 1.5s `AbortController`.
- Any failure (crypto unavailable, network, timeout) silently swallowed — never blocks UX, never toasts.

**Instrumented at 4 points** in `SearchEntryPanel.tsx` + `CreateEntityDialog.tsx`:
- Successful `runSearch` → `search_run` (queryHash, entityType, `cached`).
- "Review & create" click or "Write review" on existing match → `candidate_pick` (source, candidateIndex).
- Draft Review modal opened from search path → `review_opened`.
- Successful entity insert with `fromSearch` → `entity_created` (entityType, latencyMs from candidate click).

## 6. UX polish

- Auto-focus Search input on tab activation.
- Enter on focused candidate row triggers Review & create.
- While `enrichingIndex === idx`, replace the candidate image tile with a `<Skeleton>` (in addition to the button spinner).
- Empty-state copy: "No matches yet. Try adding the brand name, e.g. 'cetaphil gentle cleanser'."

## 7. Privacy hardening

- Remove any `console.log(query)` / `console.log(sourceUrl)` in `SearchEntryPanel.tsx` and `search-entity-candidates/index.ts`. Where a host is needed for debugging, log `safeHostname(url)` only.
- Verify `search-entity-candidates` structured logs do not include the full query string.
- `log-search-funnel` rejects raw-text keys as noted.

---

## Files touched

**New**
- `supabase/functions/log-search-funnel/index.ts`
- `supabase/migrations/<ts>_phase_3_5c_funnel.sql`
- `src/hooks/useSearchFunnel.ts`

**Edited**
- `supabase/functions/search-entity-candidates/index.ts` — conservative dedup + log scrub.
- `src/components/admin/entity-create/SearchEntryPanel.tsx` — recents, keyboard, per-tile skeleton, funnel calls, log scrub.
- `src/components/admin/CreateEntityDialog.tsx` — `pendingDuplicateOriginRef`, search-origin dialog routing, `creation_source: 'search'` fix, `search_source_url` metadata, `review_opened` + `entity_created` funnel calls.

**Not touched**
- `supabase/functions/check-entity-duplicates/index.ts`
- `supabase/functions/analyze-entity-url*`
- `supabase/functions/enrich-candidate-image/*`
- `DuplicateConfirmDialog.tsx`, `ExactUrlDuplicateDialog.tsx`
- Feature flags, `entityDraft` types, entity detail pages

---

## Success criteria

1. Same product across 3 domains appears once in "Suggested from the web"; different sizes/variants still appear separately.
2. Search-derived draft that already exists opens the existing `DuplicateConfirmDialog`; "Use this" routes to `/entity/:slug?compose=review` and the review composer opens; "It's different — continue" proceeds via existing `_duplicateConfirmed` path.
3. URL-analyze and manual duplicate dialogs behave exactly as before.
4. Search-created entities have `metadata.creation_source = 'search'` and no `metadata.created_from_url`; if applicable, `metadata.search_source_url` is set. `website_url` is never overwritten with a search citation.
5. Recent chips appear when input is empty; clicking re-runs the query. Chips never enter telemetry.
6. `search_funnel_events` receives the 4 event types with only `query_hash` (never raw query). Users cannot INSERT directly; only admins SELECT. Telemetry failure/timeout never affects the user flow.
7. No changes to URL-analyze behavior, image enrichment, feature flags, review schema, or any additional AI calls.
