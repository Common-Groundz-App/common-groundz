# Gate 5 closure — corrective fixes (revised per review)

Both reviewers are right, and their points are confirmed against the live code. I'm replacing the "make the card inert" fix with a real destination fix.

## What the code actually shows

- `reviewService.loadReviewSubjectEntities` selects `id, name, type, image_url, is_deleted` — no `slug`; the mapped `entity` object in `fetchUserRecommendations` also omits `slug`.
- `RecommendationCard.getEntityRoute` returns `null` when `entity.slug` is missing, so today **every** Recs-tab card falls through to the removed `/recommendations/:id` address. That confirms the reviewers' warning: a blanket no-op would leave the whole tab unclickable.
- `comment_count` is hardcoded to `0` for this path, and there is no review-comment destination to route to.
- `RecommendationCard` has exactly one consumer: the profile Recs tab (`ProfileRecommendations`). No other surface is affected.
- `supabase/functions/add_comment.sql` has zero references anywhere in the repo (no imports, scripts, config, tests).

## Changes

1. **Restore real navigation on the Recs tab**
   - Add `slug` to the entity lookup in `reviewService.ts` and to the mapped `entity` object (and to the `Review.entity` type). Read-only addition; no other consumer's shape shrinks.
   - Card click: navigate to the canonical entity page when the endorsement has a linked, non-deleted subject. Only a card with genuinely no linked subject does nothing.
   - No new review-detail architecture, no new routes.

2. **Remove the dead comment action**
   - Both comment-count buttons (full and compact layouts) pointed at the retired address and always showed `0`. Remove the control on this card rather than leave a disabled affordance implying a discussion that doesn't exist. Likes and share are untouched.

3. **Delete `supabase/functions/add_comment.sql`**
   - Confirmed dead standalone snapshot. The authoritative post-only definition lives in the tracked Gate 1 migration; the evidence file will name that migration so the live definition stays easy to find.

4. **Correct the Phase 4.3 record**
   - The earlier note "the Recs tab disappears" is factually wrong. Document that the tab was retained as a review-endorsement surface (`reviews.is_recommended`), add it to the preservation checklist, and record that it has zero dependency on the retired tables.

## Verification before closing Gate 5

- Repo-wide sweep for `/recommendations/` and `/recommendation/`, every hit classified as intentional (test, doc, migration history, generated types) or a defect.
- Recs-tab card navigation checked in the running app on `/u/hana.li?tab=recommendations`: linked cards open the entity page, no navigation to the retired address.
- Preservation spot-checks: recommendation-type posts behave as normal posts with working comments/likes and normal post notification destinations; `reviews.is_recommended` untouched; Entity V4 recommending/from-circle counts and the "Recommended by Your Circle" card unchanged; `UserRecommendationCard`, `fallbackRecommendationService`, `networkRecommendationService`, `ChatRecommendationCards`, `JourneyRecommendationCard` unmodified.
- Full test suite, type check, build.
- Gate 5 evidence file updated with both leftovers, their fixes, and the sweep classification.

No database schema changes. Stop after Gate 5 — no Gate 6, no legacy schema drops.
