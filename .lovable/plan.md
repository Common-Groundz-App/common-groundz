## I agree with the corrections

The latest feedback makes the plan simpler and safer. I will adopt all of the corrections below.

## What we will implement

### Phase 1 — Finalization telemetry (do this first)

When an admin creates an entity from Search-to-Draft, log a privacy-safe diff to `search_funnel_events.diagnostics` via the existing `log-search-funnel` edge function.

#### Telemetry fields

Only booleans and approved enum labels. No raw values, no URLs, no product names, no query text.

```txt
nameChanged: boolean
categoryChanged: boolean
brandChanged: boolean
imageChanged: boolean
descriptionChanged: boolean
websiteChanged: boolean
metadataChanged: boolean
imageUserReplaced: boolean
initialImageSource: InitialImageSource
finalImageSource: FinalImageSource
brandDecisionType: BrandDecisionType
imageMethod?: "google_cse" | "unknown"  // only when source is google_images
```

`InitialImageSource` values:

```txt
page_metadata
firecrawl
google_images
none
unknown
```

`FinalImageSource` values:

```txt
page_metadata
firecrawl
google_images
user_replaced
none
unknown
```

`BrandDecisionType` values:

```txt
existing
create_new
not_sure
not_listed
not_applicable
```

`imageMethod` is limited to `google_cse` or `unknown` because it only applies when the source is `google_images`. Page metadata and Firecrawl images do not need a separate method field.

#### Snapshot rules

- Capture an immutable snapshot of the Search draft at the moment it is applied to the host form.
- Store the snapshot in a ref inside `CreateEntityDialog` so it does not change after prefill.
- Reset the snapshot when:
  - the dialog closes,
  - a different Search row is picked,
  - the user switches from Search to URL/manual entry,
  - or the entity is successfully created.
- Only emit this telemetry when the creation originated from Search (`creationSource === "search"` or a Search draft snapshot exists).
- For URL/manual-created entities, do NOT send finalization diff in this phase.

#### What counts as "changed"

- `nameChanged`: saved name differs from `draft.nameGuess` (case-insensitive trimmed comparison).
- `categoryChanged`: saved `category_id` differs from `draft.categoryHint?.id`.
  - If the draft has no category ID and the admin selects one, `categoryChanged: true`.
  - If both are null/empty, `categoryChanged: false`.
- `brandChanged`: saved parent differs from the draft's recommended brand, or from the existing brand the user chose in Stage 1.
- `imageChanged`: saved `image_url` differs from the draft's recommended image.
- `descriptionChanged`: saved description differs from `draft.descriptionGuess`.
- `websiteChanged`: saved `website_url` differs from the draft's inferred website.
- `metadataChanged`: saved metadata differs from `draft.structuredHints` only for user-relevant keys. Ignore trace/debug/enrichment timestamps, internal diagnostic IDs, or volatile enrichment metadata.
- `imageUserReplaced`: the final image was a user upload/paste, not one of the draft candidates. `finalImageSource` must be `"user_replaced"` in this case.
- `initialImageSource`: source of the image that was pre-selected when the draft was applied.
- `finalImageSource`: source of the image that was saved.
- `brandDecisionType`: the type of brand decision made in Stage 1.
- `imageMethod`: optional. Only present when `initialImageSource` or `finalImageSource` is `"google_images"`. Value is `"google_cse"` or `"unknown"`.

#### Validation in `log-search-funnel`

Instead of a fuzzy "reject strings that look like raw text" rule, use an exact allow-list:

- Accept only known keys in the diff object.
- For each key, enforce the exact type.
- `initialImageSource`, `finalImageSource`, and `brandDecisionType` must be in their allowed sets.
- `imageMethod` must be `"google_cse"` or `"unknown"` if present.
- Any unknown string key or any value that is not a boolean or approved enum string is dropped.
- Reject the whole request if a raw `query`, `q`, `raw`, `text`, or `prompt` key appears at the top level or in `diagnostics`.

#### Console logging

- Store telemetry in the Supabase table always.
- Console logging only in development/debug mode.
- No production console output of telemetry events.

### Phase 2 — Minimal helper tests (do this after telemetry)

Do not add full handler tests with Supabase/auth mocking. Only export small pure helpers for offline testing.

#### Priority order for tests

Decision helpers matter more than response formatting. If a response-format helper requires extra refactoring, skip it.

#### `create-brand-entity` helpers to test

1. `shouldBackfillLogo(existingImageUrl, logoUrl, shouldWrite)` — returns true only when:
   - `shouldWrite` is true,
   - `logoUrl` is a non-empty string,
   - `existingImageUrl` is null/empty.
2. `normalizeBrandSlug(brandName)` — slug generation helper.

Optional: `buildBrandResponse(status, brandEntity, alreadyExisted)` — only if it requires no extra refactoring.

#### `resolve-brand-logo` helpers to test

1. `normalizeBrand(raw)` — strips non-alphanumeric characters and lowercases.
2. `checkRateLimit(userId, hits, now)` — returns false after 30 hits in the rolling hour.
3. `buildFlagOffResponse()` — returns `{ logoUrl: null, source: "none", cached: false, skipReason: "flag_off" }`.
4. `buildRateLimitedResponse()` — returns `{ logoUrl: null, source: "none", cached: false, skipReason: "rate_limited" }`.

Optional: `buildCacheHitResponse(cached)` — only if it requires no extra refactoring.

#### What to avoid exporting

- Full handler functions.
- Supabase client setup.
- Auth internals.
- External API pipeline pieces.
- Large inline handler chunks.

#### Test rules

- Keep tests offline and credential-free.
- No live Google CSE, Firecrawl, or Supabase integration calls.
- Mock or test only pure logic.

## What we will NOT do

- No top-3 image enrichment cap.
- No pricing prefill.
- No category resolver parity work.
- No Amazon ASIN guard for Search.
- No weak-signal filtering.
- No URL Analysis on the selected Search candidate.
- No Gemini 1.5 → 2.5 migration for URL Analysis.
- No URL Analysis changes.
- No user-facing behavior changes.
- No full edge-function handler tests in this phase.
- No Vitest/React Testing Library setup in this phase.
- No live external API calls in tests.
- No `mem://` update.

## Files likely to be touched

- `src/components/admin/CreateEntityDialog.tsx` — add Search draft snapshot ref, compute diff on save, call `logFunnel` with `entity_created` + diff.
- `src/components/admin/entity-create/DraftReviewBody.tsx` — pass `brandDecisionType` through the prefill payload so the host can log it.
- `src/hooks/useSearchFunnel.ts` — extend `FunnelPayload` and `FunnelDiagnostics` types to include the diff object.
- `supabase/functions/log-search-funnel/index.ts` — add the diff allow-list and enum validation.
- `supabase/functions/create-brand-entity/index.ts` — export small pure helpers for testing.
- `supabase/functions/resolve-brand-logo/index.ts` — export small pure helpers for testing.
- `supabase/functions/create-brand-entity/index.test.ts` — helper tests only.
- `supabase/functions/resolve-brand-logo/index.test.ts` — helper tests only.

## Verification steps

1. After telemetry changes, do a manual Search-to-Draft entity creation.
2. In the Supabase SQL editor, check the most recent `search_funnel_events` row for `event = 'entity_created'`.
3. Confirm `diagnostics.diff` contains only booleans and approved enum strings.
4. Confirm no raw query text, names, descriptions, URLs, or metadata values are stored.
5. Confirm `imageUserReplaced` is true when the admin manually replaces the image.
6. Confirm `brandDecisionType` is present and is one of the allowed enum values.
7. Confirm `initialImageSource` is never `"user_replaced"`.
8. Run the Deno helper tests for `create-brand-entity` and `resolve-brand-logo`.
9. Confirm no production console logs are emitted.
10. Confirm URL Analysis and manual entity creation flows are unchanged.

## Summary

This is a stabilization phase: telemetry first, small helper tests second, and no behavior changes. It gives us the data to decide whether future work should focus on image quality, brand matching, category resolution, or something else entirely.