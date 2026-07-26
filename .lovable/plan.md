## Current state

**Phase 1 is complete and verified.** I checked the `search_funnel_events` table for your "Shiyaaka Sky Eau de Parfum" creation and found a clean `entity_created` row:

- `event`: `entity_created`
- `source`: `search`
- `entity_type`: `product`
- `diagnostics.diff`:
  - `brandChanged: false`
  - `brandDecisionType: "create_new"`
  - `categoryChanged: true`
  - `descriptionChanged: true`
  - `finalImageSource: "google_images"`
  - `imageChanged: false`
  - `imageMethod: "unknown"`
  - `imageUserReplaced: false`
  - `initialImageSource: "google_images"`
  - `metadataChanged: true`
  - `nameChanged: false`
  - `websiteChanged: true`

This is exactly the contract: only booleans and approved enum strings, no raw names, URLs, descriptions, or query text. Edge function logs also show no errors for `create-brand-entity` or `resolve-brand-logo`.

The `searchSnapshotRef` is captured at Apply time, reset on dialog close/success/new search, and consumed once at `entity_created`. URL/manual flows are not affected.

## Next step: Phase 2 — Minimal helper tests

Phase 2 is the only remaining work from the agreed plan. We will export small, pure decision helpers from the two edge functions and write offline Deno tests. No full handler tests, no Supabase/auth mocks, no external API calls, no Vitest setup, no UI or behavior changes.

### What we will change

1. **`supabase/functions/create-brand-entity/index.ts`**
   - Extract `shouldBackfillLogo(existingImageUrl, logoUrl, shouldWrite)`.
   - Extract `normalizeBrandSlug(brandName)`.
   - Replace the inline backfill guard and slug generation with these helpers.

2. **`supabase/functions/create-brand-entity/index.test.ts`** (new)
   - `shouldBackfillLogo(..., ..., true)` returns `true` only when `existingImageUrl` is null/empty and `logoUrl` is non-empty.
   - `shouldBackfillLogo(..., ..., false)` returns `false`.
   - `shouldBackfillLogo` with empty `logoUrl` returns `false`.
   - `shouldBackfillLogo` with existing image returns `false`.
   - `normalizeBrandSlug` returns a stable, lowercase, hyphenated, trimmed slug.
   - `normalizeBrandSlug` handles special characters and multiple spaces/hyphens.
   - We will **not** test DB collision handling here; collision logic stays in the handler's existing insert loop, not inside this pure helper.

3. **`supabase/functions/resolve-brand-logo/index.ts`**
   - Export `normalizeBrand(raw)` (already exists as a local function).
   - Refactor `checkRateLimit(userId)` into `checkRateLimit(userId, hits, now)` so it can be tested with explicit inputs and no mutable module state.
   - Extract `buildFlagOffResponse()` and `buildRateLimitedResponse()`.
   - Replace inline `flag_off` and `rate_limited` responses with the helpers.

4. **`supabase/functions/resolve-brand-logo/index.test.ts`** (new)
   - `normalizeBrand` strips non-alphanumeric characters and lowercases input.
   - `checkRateLimit` returns `true` under the 30-hit rolling-hour limit and `false` at/after it.
   - `checkRateLimit` ignores hits older than 1 hour.
   - `buildFlagOffResponse` returns `{ logoUrl: null, source: "none", cached: false, skipReason: "flag_off" }`.
   - `buildRateLimitedResponse` returns `{ logoUrl: null, source: "none", cached: false, skipReason: "rate_limited" }`.

### What we will NOT do

- No full handler/HTTP tests.
- No Supabase client or auth mocking.
- No live Google CSE, Firecrawl, or database calls.
- No Vitest or React Testing Library setup.
- No changes to URL Analysis, Search enrichment, image fetching, or user-facing behavior.
- No `mem://` updates.
- No collision handling inside `normalizeBrandSlug` unless it is already there.

## Verification steps

1. Run `supabase--test_edge_functions` for `create-brand-entity` and `resolve-brand-logo`.
2. Confirm all helper tests pass.
3. Confirm the edge functions still deploy without errors.
4. Do one manual Search-to-Draft entity creation and confirm the `entity_created` telemetry row still contains only booleans and approved enums.
5. Confirm no new production console logs are added; only the existing safe telemetry log remains.
6. Confirm URL Analysis and manual entity creation flows are unchanged.

## After Phase 2

Once Phase 2 tests pass, the entire agreed-upon Phase 3.5 stabilization plan is complete. The recommended next move is to **feature-freeze Search-to-Draft** and let the new telemetry run for a few days before deciding what to improve next. Future candidates (in no particular order) include image quality, brand matching, category resolution, or something else entirely — but the telemetry should guide that decision, not speculation.