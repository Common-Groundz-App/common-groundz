# Phase 3C Stage 3 — Close-out Report

Implemented: 2026-09-05

## Scope

Stage 3 closes the recommendation-intent loop for timeline updates:

1. "Would you still recommend it?" chips when adding a timeline update.
2. A separate "Base recommendation on rating" reset control.
3. Honest source-copy display that only claims provenance when the caller has complete timeline knowledge.
4. Owner-only, newest-entry undo via the atomic `delete_latest_review_update` RPC.
5. Removal of the stale "Convert to Recommendation" action and all its call sites.

Phase 3D was **not started**.

## Files changed

- `src/services/review/types.ts` — added `would_recommend` to `ReviewUpdate`.
- `src/services/review/recommendationResolver.ts` — exported constants and helpers for source-copy mapping; added resolver regression cases.
- `src/services/review/timeline.ts` —
  - `addReviewUpdate` now accepts `wouldRecommend?: 'yes' | 'maybe' | 'no' | 'auto' | null`.
  - `fetchLatestRecommendationIntent` returns `found | none | error`.
  - `deleteLatestReviewUpdate` wraps the RPC and maps `deleted | conflict | not_found | error`.
  - Type-cast fixes for Supabase-returned `would_recommend` strings.
- `src/components/profile/reviews/ReviewTimelineViewer.tsx` —
  - Added `wouldRecommend`, `baseOnRating` form state.
  - Rendered `ChoiceChips` for Yes/Maybe/No and a separate reset button for `auto`.
  - Added owner-only "Undo" button on the newest timeline entry.
  - Refetch timeline + latest intent + parent review after insert or undo.
- `src/components/profile/reviews/ReviewCard.tsx` — removed `onConvert` prop and convert menu items.
- `src/hooks/use-reviews.ts` — removed `convertToRecommendation`.
- `src/components/profile/ProfileReviews.tsx` — removed convert wiring.
- `src/services/review/core.ts` — removed `convertReviewToRecommendation`.
- `src/services/reviewService.ts` — removed `convertReviewToRecommendation`.
- `src/services/review/__tests__/recommendationResolver.test.ts` — added regression cases.
- `src/services/review/__tests__/timelineRecommendation.test.ts` — added intent/undo unit tests.
- `src/components/profile/reviews/__tests__/ReviewTimelineViewer.test.tsx` — added DOM tests for recommendation UI.
- `roadmap.md` — marked Stage 3 delivered.

## Final `addReviewUpdate` signature

```ts
export const addReviewUpdate = async (
  reviewId: string,
  userId: string,
  rating: number | null,
  comment: string,
  media?: MediaItem[],
  wouldRecommend?: WouldRecommendValue, // 'yes' | 'maybe' | 'no' | 'auto' | null
): Promise<boolean>
```

## Semantics verified

| User action | `wouldRecommend` argument | Column written | Resolver effect |
|-------------|---------------------------|----------------|-----------------|
| Chips untouched / chip re-tapped to clear | `undefined` or `null` | omitted (keeps previous non-null intent) | previous timeline intent stays authoritative |
| Yes / Maybe / No selected | `'yes' / 'maybe' / 'no'` | explicit value | `timeline_explicit` |
| "Base recommendation on rating" | `'auto'` | `'auto'` | `intent: null`, `source: rating_inferred` |

## Source-copy rules

The helper `resolveRecommendationForReview` accepts a `hasCompleteTimelineKnowledge` flag.
It may claim `timeline_explicit` only when the caller holds the full, unpaginated timeline.
If the timeline is partial, loading, or errored, the review's materialized `is_recommended` is
rendered without a provenance claim. `fetchReviewUpdates` is currently unpaginated, so the flag
derives from that fact; adding pagination later must update the flag or the helper refuses to
claim timeline provenance.

## Undo behaviour

- Only the newest timeline entry shows "Undo".
- Only the review owner sees it.
- Clicking it calls `delete_latest_review_update(reviewId, updateId)`.
- Outcomes:
  - `deleted` — success, all three refetches run.
  - `conflict` — neutral toast: "A newer update exists, so this one can no longer be undone."
  - `not_found` / `error` — generic error toast.
- No client-side `DELETE` is issued.

## Removed Convert identifiers

Grep confirms no remaining call sites:

- `convertToRecommendation` — removed from `use-reviews.ts` and `ProfileReviews.tsx`.
- `convertReviewToRecommendation` — removed from `services/review/core.ts` and `services/reviewService.ts`.
- `onConvert` — removed from `ReviewCard.tsx` props and menu.
- `ReviewCard` no longer accepts an `onConvert` prop.

`reviews.is_converted` was left untouched (Phase 3D concern).

## Verification results

| Check | Result |
|-------|--------|
| Vitest unit + DOM tests | **612/612 PASS** |
| TypeScript type check (`tsgo --noEmit`) | **PASS** |
| Production build (`bun run build`) | **PASS** |
| Source-copy helper covers `timeline_explicit`, `review_explicit`, `rating_inferred`, `intent: null`, and unavailable data | **PASS** (unit tests) |
| Payload semantics: chip → value, skipped → omitted, re-tap → omitted, reset → `auto` | **PASS** (unit + DOM tests) |
| Resolver regression: `no` + `null` → `timeline_explicit` vs `no` + `auto` → `rating_inferred` | **PASS** |
| Per-entry display: yes/maybe/no literal, `auto` reset wording, `null` nothing | **PASS** (DOM tests) |
| Undo status mapping and parent-review refetch | **PASS** (unit tests) |
| No remaining Convert call sites | **PASS** (`rg` search) |
| Phase 3D not started | **CONFIRMED** |

## Unverified / carry-over items

These were explicitly labelled as out of scope for Stage 3 and remain open from Stage 1:

- Advisory-lock concurrency races across parallel sessions (insert vs undo, undo vs undo, maintenance vs undo, two different reviews).
- Authenticated owner INSERT / owner undo / non-owner INSERT denial via a real Supabase session (`auth.uid()` present). The project uses an external Supabase project; Lovable cannot mint a test session for it.
- Regenerate Supabase types (`src/integrations/supabase/types.ts`).

These are listed as **UNVERIFIED**, not substituted.

## Next boundary

Phase 3D was not started. Do not begin it until explicitly requested.
