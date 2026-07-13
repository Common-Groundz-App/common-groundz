# Phase 3.5a — Search-to-Draft (final, v5)

Purely additive. The URL pipeline (`analyze-entity-url-v2`, its prompt, resilience, URL body in `CreateEntityDialog`, `EntityModerationBanner`, review body, `PostCreateContinuation`) is not touched. A new **Search** tab sits next to "Paste URL".

## Model

- **Default:** `gemini-3.5-flash`.
- **Env override:** `GEMINI_GROUNDED_MODEL`.
- Constant `DEFAULT_GEMINI_GROUNDED_MODEL` lives in the edge function; echoed in `diagnostics.model`.

## Changes since v4

| # | Concern | Decision |
|---|---|---|
| 1 | `set_app_flag` allowlist must accept the new key or the admin toggle silently fails | **Adopted.** Migration updates `public.set_app_flag` to accept `search_to_draft.non_admin_enabled` with exact shape `{ "enabled": boolean }`, matching how `entity_creation.non_admin_enabled` is validated today. |
| 2 | Prefer Interactions API over `generateContent` | **Adopted as strong preference in build-step 0.** During verification, if the Interactions API supports `google_search` + JSON output + `groundingMetadata` cleanly, use it. Otherwise fall back to `generateContent` (still documented for `gemini-3.5-flash` + grounding). Decision recorded in the function header comment. |
| 3 | Don't log raw `searchEntryPoint.renderedContent` HTML | **Adopted.** Log only safe metadata: `hasSearchEntryPoint`, `renderedContentLength`, `renderedContentHash` (short SHA-256 hex). Raw HTML returned only to admin callers under `diagnostics.groundingAttribution`. Never rendered in 3.5a. |

Everything else from v4 stands.

## Access-control matrix (unchanged)

| User | `entity_creation.non_admin_enabled` | `search_to_draft.non_admin_enabled` | Search tab | URL tab |
|---|---|---|---|---|
| Admin | any | any | ✅ | ✅ |
| Regular | ON | ON | ✅ | ✅ |
| Regular | ON | OFF | ❌ | ✅ |
| Regular | OFF | any | ❌ dialog gated | ❌ |

Edge function enforces both flags server-side (403 `search_disabled`). Rollout ships with `search_to_draft.non_admin_enabled = false`; admin flips it ON from the Feature Flags tab whenever ready.

## Flow

```text
CreateEntityDialog
  [ Paste URL ]  [ Search ]  ← NEW
   ├─ URL tab: existing JSX, untouched
   └─ Search tab:
       [ "cetaphil cleanser" ]  [ Search ]
       ─ Already on CommonGroundz
          • Cetaphil Gentle Skin Cleanser  [Open]
       ─ Suggested from the web
          • Cetaphil Gentle Skin Cleanser
            Product · Cetaphil · High
            cetaphil.com · Google Search  [Review & create]
          • ... up to 5
             │ Review & create
             ▼
    brand pre-match (client) → applyEntityDraft → existing review body
             │ Save
             ▼
    existing duplicate check → create → existing continuation
```

## Backend

### Build step 0 (verification, before writing function code)

1. `fetch_website` on `https://ai.google.dev/gemini-api/docs/generate-content/google-search`. Confirm:
   - Does the **Interactions API** support `google_search` tool + JSON output + `groundingMetadata`? If yes → use it.
   - Otherwise confirm current `generateContent` REST payload for `gemini-3.5-flash` + `"tools": [{ "google_search": {} }]` + `responseMimeType: "application/json"` + `groundingMetadata` shape.
2. `code--view supabase/functions/check-entity-duplicates/index.ts` — mirror `is_deleted` / `approval_status` filters exactly.
3. `supabase--read_query` on `entities` for column names.

Record the chosen API path in a header comment in the edge function so future maintainers know why.

### New: `supabase/functions/search-entity-candidates/index.ts`

**Request:** `POST { query: string, typeHint?: EntityType }`

**Gates (in order):**
1. CORS preflight.
2. JWT required → 401. `has_role` RPC (service-role client) → `isAdmin`.
3. If not admin: require BOTH `isNonAdminEntityCreationEnabled()` AND `isNonAdminSearchToDraftEnabled()` → 403 `{ error: "search_disabled" }`.
4. `GEMINI_API_KEY` missing → 500 `{ error: "search_not_configured" }`. No silent fallback.
5. Normalize query (`trim().toLocaleLowerCase().replace(/\s+/g,' ')`); length 3–160 → 400.
6. Atomic rate limit via `increment_search_rate_limit(user_id)` → 429 `{ retryAfterSeconds }` when count > 20.
7. Opportunistic cleanup: `if (Math.random() < 0.01) delete from search_rate_limits where window_start < now() - interval '48 hours'`.

**Cache:** in-memory `Map<key, entry>`; key = `${model}|${typeHint ?? ''}|${normalizedQuery}`; TTL 15 min; LRU cap 200. On cache hit still refetch `existingMatches` fresh from DB.

**Parallel work:**
- **Internal:** `match_entities_by_name` RPC (threshold 0.55, limit 5), filtered like `check-entity-duplicates`.
- **External (cache miss only):** Gemini native REST (Interactions API preferred per step 0), 12s timeout, temperature 0.2, JSON response.

**Prompt (strict JSON):**
```
User query: "<query>"
Type hint: "<typeHint or 'unknown'>"

Return 4–5 distinct real-world entity candidates the user likely means.
Rules:
- JSON only. No prose. No markdown fences.
- Prefer specific products/items over category/brand landing pages.
- Distinct variants are distinct candidates.
- Do not invent. If unsure, lower confidence rather than guess.
- Cite the primary source URL for each candidate.

Schema:
{ "candidates": [{
    "name": string, "type": "product|brand|place|book|movie|food|app|tv",
    "brand": string|null, "variant": string|null, "category": string|null,
    "description": string, "imageUrl": string|null,
    "sourceUrl": string, "sourceTitle": string|null, "confidence": number
}] }
```

Tolerant JSON parse (balanced-brace recovery). Parse failure → empty candidates + `errorCode: "parse_failed"`.

**Attribution handling (compliance + safety):**
- Extract `groundingMetadata.searchEntryPoint.renderedContent`.
- Log ONLY: `{ hasSearchEntryPoint, renderedContentLength, renderedContentHash }` (SHA-256 first 12 hex). No raw HTML in logs.
- Response includes `diagnostics.groundingAttribution` (raw string) **only when `isAdmin === true`**.
- Never rendered in 3.5a UI (admin or not).

**Failure modes:**

| Situation | `existingMatches` | `candidates` | `errorCode` |
|---|---|---|---|
| All good | DB rows | up to 5 | — |
| Gemini timeout/5xx | DB rows | `[]` | `grounding_unavailable` |
| Parse failure | DB rows | `[]` | `parse_failed` |

**EntityDraft mapping per candidate:**
- `schemaVersion: 1`, `inputMethod: "search"`, `inputRef: <original query>`.
- `nameGuess`, `typeGuess`, `descriptionGuess`.
- `structuredHints`: `{ variant, category, sourceTitle, sourceUrl, displayDomain }` — full untruncated `sourceUrl`.
- `brandCandidates`: `[{ name: brand, source: "google_grounding", confidence, status: "suggested_new" }]` — client re-checks before review.
- `imageCandidates`: `[{ url: imageUrl, source: "google_grounding", confidence }]` when present.
- `sourceEvidence`: `[{ field: "name", value: displayDomain, source: "google_grounding", confidence }]`.

**Response (client-safe):**
```ts
{
  existingMatches: Array<{ id, name, slug, imageUrl, type }>,
  candidates: EntityDraftCandidate[],
  diagnostics: {
    model, groundingUsed, cached, latencyMs, warnings, errorCode?,
    groundingSources: Array<{ title, domain }>,
    hasSearchEntryPoint: boolean,
    // admin-only:
    groundingAttribution?: string
  }
}
```

### Contract additions (additive)

Add `"google_grounding"` to `CandidateSource` in all three mirrors:
- `supabase/functions/_shared/contracts/entityDraft.types.ts`
- `supabase/functions/_shared/contracts/entityDraft.schema.ts` (Zod enum)
- `src/types/entityDraft.ts`

### New helper: `isNonAdminSearchToDraftEnabled` in `supabase/functions/_shared/feature_flags.ts`

Mirrors the existing `isNonAdminEntityCreationEnabled` (30s in-memory cache). Reads `search_to_draft.non_admin_enabled` from `app_config` via a new SQL helper `is_non_admin_search_to_draft_enabled()` (same pattern as its counterpart).

### DB migration (single migration, all pieces together)

```sql
-- 1. rate limit table
CREATE TABLE public.search_rate_limits (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_rate_limits TO service_role;
ALTER TABLE public.search_rate_limits ENABLE ROW LEVEL SECURITY;
-- service-role only, no policies.

-- 2. atomic increment RPC
CREATE OR REPLACE FUNCTION public.increment_search_rate_limit(_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_count int;
BEGIN
  INSERT INTO public.search_rate_limits (user_id, window_start, count)
  VALUES (_user_id, date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET count = search_rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_search_rate_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_search_rate_limit(uuid) TO service_role;

-- 3. seed the new feature flag (OFF by default)
INSERT INTO public.app_config (key, value, description)
VALUES (
  'search_to_draft.non_admin_enabled',
  '{"enabled": false}'::jsonb,
  'When true, non-admin users see the Search tab in Create Entity (Gemini grounded search).'
)
ON CONFLICT (key) DO NOTHING;

-- 4. read helper mirroring is_non_admin_entity_creation_enabled
CREATE OR REPLACE FUNCTION public.is_non_admin_search_to_draft_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
     FROM public.app_config
     WHERE key = 'search_to_draft.non_admin_enabled'),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_non_admin_search_to_draft_enabled() TO anon, authenticated, service_role;

-- 5. CRITICAL: extend set_app_flag allowlist so the admin toggle works.
--    Recreate the function preserving current behavior; add the new key
--    with { "enabled": boolean } shape validation (matching how
--    entity_creation.non_admin_enabled is validated today).
--    Exact CREATE OR REPLACE is derived from the current definition read
--    via supabase--read_query on pg_proc during build; only additive
--    branches are added — no existing key handling is changed.
```

Build-time step: before writing this migration, `supabase--read_query` the current `set_app_flag` definition and patch it minimally — add a new branch for `search_to_draft.non_admin_enabled` validating `{ "enabled": boolean }`. Do not rewrite any other branch.

## Frontend

### New: `src/hooks/useSearchToDraftEnabled.ts`
Returns true for **admin OR (non-admin with flag ON)**. Reads `app_config['search_to_draft.non_admin_enabled']` (or a public flag RPC path if that's the pattern for the sibling flag — mirror it).

### Edit: `src/hooks/admin/useAppFlagsAdmin.ts`
Add `'search_to_draft.non_admin_enabled'` to `ALLOWED_KEYS`. Verified: the toggle backend (`set_app_flag`) is updated in the migration above, so the admin flip actually persists.

### New: `src/components/admin/entity-create/SearchEntryPanel.tsx`
- Input + **Search button** (Enter submits; disabled < 3 chars).
- Loading: skeleton rows (per Core rule: skeletons, not spinners).
- **Section 1** "Already on CommonGroundz": image, name, type badge, **Open** → `navigate('/entity/:slug')` + close dialog.
- **Section 2** "Suggested from the web": up to 5 cards — image/placeholder, name, brand, type badge, confidence chip (High ≥0.8 / Medium ≥0.5 / Lower), domain chip "Google Search", **Review & create**.
- **Error copy:**
  - 429 → "You've made a lot of searches. Try again in a few minutes."
  - 403 `search_disabled` → tab hidden at parent; defensive hide.
  - 500 `search_not_configured` → "Search is temporarily unavailable. Try Paste URL instead."
  - `errorCode` + existing matches → matches + banner "We could only check CommonGroundz. Web suggestions are temporarily unavailable."
  - `errorCode` + no matches → "Search is temporarily unavailable. Try again in a moment or use Paste URL."
  - Success + 0 results → "No matches. Try a more specific name."

### New: `src/components/admin/entity-create/applyEntityDraft.ts`
- `applyEntityDraft(draft, setters)` — populates existing review-body state.
- `enrichBrandCandidatesWithExistingMatch(candidates)` — runs `brandDuplicateCheck` per `suggested_new` brand; upgrades to `matched_existing` on exact-normalized hit. Runs before opening review.

### Edit: `src/components/admin/CreateEntityDialog.tsx` (additive only)
- Wrap current body in `<Tabs defaultValue="url">`.
- Move existing JSX into `<TabsContent value="url">` unchanged.
- Add `<TabsContent value="search">` with `<SearchEntryPanel onPick={handlePickFromSearch} />`.
- `handlePickFromSearch`: enrich brand → `applyEntityDraft` → flip to review step via URL flow's existing mechanism.
- Search tab hidden when `useSearchToDraftEnabled()` returns false.

### Source-chip label
`"google_grounding" → "Google Search"` wherever `CandidateSource` renders as a UI chip.

## Files

**New (5)**
- `supabase/functions/search-entity-candidates/index.ts`
- `src/components/admin/entity-create/SearchEntryPanel.tsx`
- `src/components/admin/entity-create/applyEntityDraft.ts`
- `src/hooks/useSearchToDraftEnabled.ts`
- One migration file (rate-limit table + RPC + flag seed + read helper + `set_app_flag` patch)

**Edited (6, additive only)**
- `src/components/admin/CreateEntityDialog.tsx`
- `src/hooks/admin/useAppFlagsAdmin.ts`
- `supabase/functions/_shared/contracts/entityDraft.types.ts`
- `supabase/functions/_shared/contracts/entityDraft.schema.ts`
- `src/types/entityDraft.ts`
- `supabase/functions/_shared/feature_flags.ts`

**Untouched:** all URL-flow files, `analyze-entity-url*`, `EntityModerationBanner`, `PostCreateContinuation`, duplicate dialogs, other feature flags.

## Secrets

- `GEMINI_API_KEY` — requested via `add_secret` at build start.
- `GEMINI_GROUNDED_MODEL` — optional; default `gemini-3.5-flash`.

## Success criteria

1. "cetaphil cleanser" → ≤3s typical (3–8s acceptable) → up to 5 distinct variant candidates with citations.
2. Review & create → same review modal as URL path, pre-filled → Save → same continuation.
3. Cetaphil brand in DB → BrandPicker shows `matched_existing` before review opens.
4. Existing entity query → "Already on CommonGroundz" first; Open navigates.
5. URL tab identical to today.
6. Non-admin + flag OFF → Search tab hidden; direct edge call → 403.
7. **Admin flips flag ON in Feature Flags tab → toggle persists (not silently rejected by `set_app_flag`)**; non-admin sees tab within 30s.
8. 21st call/hour → 429; concurrent calls at count=20 → only one succeeds (atomic).
9. Second identical search within 15 min → `diagnostics.cached: true`, no Gemini call in logs.
10. Gemini timeout → existing matches + partial-fail banner.
11. No `analyze-entity-url-v2` call in Search path.
12. `structuredHints.sourceUrl` = full URL; `sourceEvidence.value` = display domain.
13. **Edge logs contain only `hasSearchEntryPoint`/length/hash — never raw HTML.**
14. `diagnostics.groundingAttribution` present only for admin callers; never rendered.
15. `search_rate_limits` rows older than 48h get pruned.

## Out of scope for 3.5a

- Lazy per-candidate image enrichment (→ 3.5b)
- Review/Post shortcuts on existing matches (→ 3.5b)
- Rendering `searchEntryPoint` widget (compliance review gates rollout of rendering)
- Type-specific boosters (Books/OMDb/Places/OFF)
- Barcode (3.7), image upload (3.6)
- Any URL-flow change
