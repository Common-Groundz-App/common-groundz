# Phase 1.8c.6-B (Final, approved) — Intent-Aware Page-Owned Image Priority

Incorporates the final ChatGPT + Codex clarification about which entity-type value to pass from `CreateEntityDialog`. Also reflects the user's draft-leftover constraint: **AI analysis is the source of truth at the time of the metadata call; user override happens later through the form**.

## The rule (locked)

| Caller intent at invoke time | `fetch-url-metadata-lite` | `enrich-brand-data` |
|---|---|---|
| `entityType: "brand"` | **Google first**, page-owned ignored, no new HTML fetch | **Google first**, page-owned fallback only when Google fails |
| `entityType` non-brand (product, book, place, etc.) | **Page-owned first**, Google fallback | n/a |
| `entityType` omitted | page-owned first (safe generic-preview default; current known callers will not hit this) | n/a |

We never infer brand from URL, title, or domain.

## Caller audit (confirmed)

`fetch-url-metadata-lite` has exactly two callers; both wired in this same patch (no deferral):

1. `src/hooks/recommendations/use-entity-operations.ts` — `fetchUrlMetadata()` called from `handleEntityCreation()` which holds `correctedType: EntityType`. Pass `correctedType`.
2. `src/components/admin/CreateEntityDialog.tsx` line 965 — the metadata invoke runs **immediately after** `aiResult` returns and **before** AI predictions are merged into `formData`. At this moment:
   - `aiResult.data?.predictions?.type` is the freshest signal (AI just ran on the submitted URL).
   - `formData.type` may contain a stale draft value left over from a previous session, an unrelated pre-selection, or be empty.
   - Per the user's instruction, AI prediction wins here; manual override happens later through the form UI (subsequent edits) — not at this invoke.

   Resolution order at line 965:
   ```ts
   entityType:
     aiResult.data?.predictions?.type
     ?? (formData.type && formData.type !== '' ? formData.type : null)
     ?? null
   ```
   AI prediction first → non-empty `formData.type` fallback (covers the case where AI didn't return a type) → `null`.

No other callers exist.

## Scope

### In scope
- `supabase/functions/fetch-url-metadata-lite/index.ts` — accept optional `entityType`; choose image-priority path; extract page-owned candidates on non-brand/unknown path; emit telemetry.
- `supabase/functions/enrich-brand-data/index.ts` — keep Google-first; add page-owned official-site fallback **only when no Google candidate has `score > 0`**; no score bump.
- New local `image_validation.ts` in each function (copy of A.2 helper; edge functions can't cross-import).
- `src/hooks/recommendations/use-entity-operations.ts` — thread `EntityType` from `handleEntityCreation` into `fetchUrlMetadata` and include it in the invoke body.
- `src/components/admin/CreateEntityDialog.tsx` — include `entityType` in the invoke body using the AI-first resolution above.

### Out of scope (byte-unchanged)
V2 (`analyze-entity-url-v2`), A.1, A.2, `merge.ts`, recovery, Gemini, Firecrawl settings, parser, guard, Zod, frontend UI behavior beyond the two invoke bodies, DB, schema, category matching, Google scoring weights, brand description cascade.

## Behavior — `fetch-url-metadata-lite/index.ts`

**New optional request field:** `entityType?: string`. Normalized server-side: `String(entityType ?? "").trim().toLowerCase() === "brand"` → brand path. Any other non-empty value → non-brand path. Empty/missing → unknown path.

**Image-priority paths:**
- `brand` → `image_priority_path: "brand_first_google"` — current Google-first behavior is **byte-identical to today**. No HTML scraping for page-owned image candidates. Existing Open Graph fallback (only when Google returns zero results) stays as-is.
- non-brand → `image_priority_path: "non_brand_page_first"`.
- omitted/empty → `image_priority_path: "unknown_page_first"` (same logic as non-brand).

**Page-owned candidates (non-brand/unknown only):** extracted from page HTML in this order: `og:image` → `twitter:image` → `<link rel="image_src">`. JSON-LD `image` is not added here.

**HTML acquisition (honest about network calls):**
1. If `pageHtml` is already in memory from `extractProductName(url)` (caller didn't pass a product name) → reuse it; no new fetch; `pageHtmlFetchedForImage: false`.
2. If `pageHtml` is empty AND path is non-brand/unknown → perform **one** bounded HTML fetch with the existing `AbortSignal.timeout(10000)` and the same User-Agent block already used in `extractProductName`. Reuse the HTML for image, description, and favicon (description/favicon currently skip entirely in this branch — a free correctness win). Set `pageHtmlFetchedForImage: true`.
3. Brand path skips this entirely. `pageHtmlFetchedForImage` stays `false`. Zero new network cost on the brand path.
4. Any fetch failure is silent and falls back to current Google-first behavior.

**Selection on non-brand/unknown path:**
- Candidates pass `isValidPageImageUrl` (http/https only; rejects `data:`/`blob:`/`javascript:`/malformed/tracking pixels/favicons/`.ico`).
- First valid page-owned candidate becomes `image` (primary) and goes first in `images[]`.
- Google results follow, deduped by URL string.
- If no valid page-owned candidate → behavior is identical to today (Google wins; OG fallback when Google empty).

## Behavior — `enrich-brand-data/index.ts`

Existing pipeline (Phase 1 site-scoped Google → Phase 2 broader Google → score → accept best `score > 0`) is the **primary** path and is **unchanged**.

**New fallback (only runs when Google fails):**
- If best Google candidate `score > 0` → return Google result, set `logoSource = "google_site_scoped"` or `"google_broad"`. **Identical to today.**
- If `score ≤ 0` or no Google candidates → try page-owned official-site assets from the HTML that `scrapeDescription` already downloaded, in order:
  1. `og:image` → `logoSource: "page_owned_og"`
  2. `apple-touch-icon` (any size) → `logoSource: "page_owned_apple_touch_icon"`
  3. `<link rel="icon">` with explicit `sizes` ≥ 128 → `logoSource: "page_owned_favicon"`
- Each candidate must pass `isValidPageImageUrl`.
- If `scrapeDescription` did not run or returned no HTML → fallback skipped cleanly. `pageOwnedLogoCandidateCount = 0`.
- **No score bump. No competition with Google. Page-owned assets only fill the gap.**

## Frontend caller wiring (in this patch)

`src/hooks/recommendations/use-entity-operations.ts`:
- `fetchUrlMetadata` gains optional `entityType?: string` (4th arg).
- `handleEntityCreation` calls `fetchUrlMetadata(websiteUrl, undefined, undefined, correctedType)`.
- Invoke body includes `entityType` when defined and non-empty.

`src/components/admin/CreateEntityDialog.tsx`:
- Line 965 invoke body adds the AI-first resolution shown above.
- No other UI/state changes. Manual type override after AI analysis is a user-driven later edit and is not affected by this patch.

No schema change. No DB change.

## Telemetry (privacy-safe — no raw URLs/descriptions)

`fetch-url-metadata-lite` response `metadata` block adds:
- `entityType: string | null` — echoes resolved caller input.
- `entityTypeSource: "caller" | "omitted"` — `"caller"` whenever the request body included a non-empty string; `"omitted"` otherwise.
- `image_priority_path: "brand_first_google" | "non_brand_page_first" | "unknown_page_first"`.
- `pageOwnedImageFound: boolean`.
- `pageOwnedImageWon: boolean`.
- `pageHtmlFetchedForImage: boolean` — true only when the bounded new fetch (path 2 above) ran.

`enrich-brand-data` response adds:
- `logoSource: "google_site_scoped" | "google_broad" | "page_owned_og" | "page_owned_apple_touch_icon" | "page_owned_favicon" | "none"`.
- `pageOwnedLogoCandidateCount: number`.
- `pageOwnedLogoUsedAsFallback: boolean`.

## Files

```text
NEW
  supabase/functions/fetch-url-metadata-lite/image_validation.ts   (copy of A.2 helper)
  supabase/functions/enrich-brand-data/image_validation.ts         (copy of A.2 helper)
  supabase/functions/fetch-url-metadata-lite/index_test.ts
  supabase/functions/enrich-brand-data/index_test.ts

EDITED
  supabase/functions/fetch-url-metadata-lite/index.ts
  supabase/functions/enrich-brand-data/index.ts
  src/hooks/recommendations/use-entity-operations.ts
  src/components/admin/CreateEntityDialog.tsx
  .lovable/plan.md
```

## Tests

### `fetch-url-metadata-lite` (8 tests)
1. **Non-brand** with valid `og:image` → page-owned wins, first in `images[]`, `image_priority_path = "non_brand_page_first"`, `entityTypeSource = "caller"`, `pageOwnedImageWon = true`.
2. **Non-brand**, no valid page-owned image → Google wins (regression guard), `pageOwnedImageWon = false`.
3. **Explicit brand** with valid `og:image` AND Google result present → Google wins, `image_priority_path = "brand_first_google"`, `entityTypeSource = "caller"`, `pageOwnedImageWon = false`, `pageHtmlFetchedForImage = false`.
4. **Omitted entityType** generic preview → `image_priority_path = "unknown_page_first"`, `entityTypeSource = "omitted"`, page-owned behavior applies.
5. **Invalid page-owned image** (`data:` URL, tracking pixel, `.ico`) → does NOT override Google on non-brand path.
6. **Dedup** — page-owned URL identical to a Google result → single entry, page-owned position wins, no duplicates.
7. **Bounded-fetch honesty** — caller provides `productName` AND `entityType` non-brand → exactly one new HTML fetch, `pageHtmlFetchedForImage = true`.
8. **Brand path skips fetch** — caller provides `productName` AND `entityType: "brand"` → no new HTML fetch, `pageHtmlFetchedForImage = false`.

### `enrich-brand-data` (5 tests)
9. Google `score > 0` AND page-owned `og:image` present → Google wins, `logoSource` starts with `google_`, `pageOwnedLogoUsedAsFallback = false`.
10. Google `score ≤ 0` AND valid page-owned `og:image` → page-owned wins, `logoSource = "page_owned_og"`, `pageOwnedLogoUsedAsFallback = true`.
11. No Google AND no page-owned → `logoSource = "none"`, current "logo not found" path unchanged.
12. Invalid page-owned asset (favicon-only / tracking pixel / `data:`) on fallback path → ignored; result stays `"none"` if Google also failed.
13. `scrapeDescription` returned no HTML → fallback skipped cleanly, no exception, `pageOwnedLogoCandidateCount = 0`.

All telemetry assertions verify that no raw URLs or descriptions appear in any diagnostic string.

## Retest matrix after ship

**Non-brand product URLs** — expect page-owned image win, `entityTypeSource: "caller"`:
- Myntra product page, Tira product page, Fila product page, Maccaron product page, one Amazon non-brand product URL, one independent shop URL.

**Explicit Brand entries** — expect Google logo win, `image_priority_path: "brand_first_google"`, `pageHtmlFetchedForImage: false`:
- Brand creation for "Myntra", "Tira", "Nykaa" — confirm logo is the actual brand mark, not site favicon or hero `og:image`.

**Draft-leftover sanity check** — start brand creation with a stale `formData.type = "product"` from a draft, paste a brand URL, run analyze; verify the metadata-lite invoke received the AI-predicted `"brand"` (not the stale draft value).

**Brand fallback (rare)** — obscure brand where Google returns no candidate above threshold → confirm page-owned `og:image` fallback kicks in and `pageOwnedLogoUsedAsFallback: true`.

**Latency check** — review `fetch-url-metadata-lite` logs for the new bounded fetch path (`pageHtmlFetchedForImage: true`). If p95 latency on non-brand creates worsens noticeably, the 10s timeout can be tightened in a follow-up.

## Risk and rollback

- Brand path is **byte-identical** to today on both functions when `entityType: "brand"` is passed — and both callers now pass it.
- Non-brand path adds at most one bounded HTML fetch (silent failure → Google fallback).
- No DB or schema risk.
- Rollback: revert the two `index.ts` edits and the two frontend caller edits; new `image_validation.ts` files become unused but harmless.

## Next phase

**1.8c.7** — unify the three duplicate `image_validation.ts` copies into a single shared module under `supabase/functions/_shared/`. Refactor only, no behavior change.
