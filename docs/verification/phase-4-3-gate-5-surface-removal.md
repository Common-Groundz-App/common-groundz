# Phase 4.3 — Gate 5: legacy recommendation surface removal

No database schema changes. Tables, enums and columns remain until Phase 4.5.

## Removed

- `src/pages/RecommendationView.tsx` (static tombstone) and
  `src/components/content/RecommendationContentViewer.tsx` — deleted.
- `src/App.tsx` — `/recommendations/:recommendationId` route and its import removed.
- `public/_redirects` — the `/recommendations/*` SPA fallback line removed
  (Lovable hosting ignores this file; removed for consistency only).
- `src/utils/contentRoutes.ts` — `RoutableContentType` is now `'post'`;
  `/recommendations` base and the `recommendation` branch of
  `isRoutableContentType` removed. Function names, signatures and return shapes
  unchanged.
- `src/utils/notificationDestination.ts` — legacy singular `/recommendation/`
  rewrite removed and `recommendations` removed from the path allowlist, so any
  surviving legacy `action_url` resolves to no destination. Added an explicit
  early branch: `entity_type = 'recommendation'` → `{ kind: 'none', reason:
  'unsupported-type' }`, so retired rows never fall through to their stored
  legacy URL (which would otherwise surface as `unsafe-url`).
- `src/services/notificationService.ts` — `recommendation` case removed from
  `getContentUrl` (falls through to `#`). The `EntityType` union keeps
  `'recommendation'` and `notificationRealtime.ts` keeps accepting it, so rows of
  that shape are still validated rather than treated as unknown events.
- `src/utils/notificationThumbnail.ts` — `THUMBNAIL_TARGET_TYPES` is `['post']`;
  the `recommendation` bucket is gone from `collectTargetIds`.
- `src/hooks/notifications/useNotificationTargets.ts` — unreachable posts-only
  guard comment removed; post fetching unchanged.
- `src/utils/notificationGrouping.ts` — grouping is post-only
  (`GROUPABLE_ENTITY_TYPES = {'post'}`); the noun helper always reads
  "your post".
- `src/services/commentsService.ts` — the legacy `recommendation_comments` /
  `recommendation_id` branch removed (post-only), and the `itemType` /
  `commentType` unions narrowed to `'post'`. All live callers already passed
  `"post"`; `InlineCommentThread` and `CommentDialog` prop types narrowed to
  match.
- `supabase/functions/cleanup-orphan-media/index.ts` and
  `cleanup-orphan-media-execute/index.ts` — the `recommendations.image_url`
  reference blocks and their header mentions removed. These were the last live
  readers of the legacy table.

## Tests

Updated, not deleted:

- `notificationDestination.test.ts` — retired recommendation like, legacy
  recommendation comment (with stored legacy `action_url`) → no destination;
  legacy singular and plural recommendation `action_url` → `unsafe-url`; reply
  case retargeted to a post. All other cases (post like, legacy post comment,
  mention, comment like, follow, profile, journey, review, non-UUID comment id,
  external URL) keep their existing assertions.
- `notificationGrouping.test.ts` — recommendation rows are not groupable; the
  post noun is always used.
- `notificationThumbnail.test.ts` — recommendation targets excluded; buckets are
  `{ post: [] }`.

## Verification

- Repo-wide sweep (beyond `src/` and `supabase/functions/`): no remaining reader
  of the legacy tables and no reference to the `/recommendations/:id` route
  outside historical migrations, `docs/`, `roadmap.md`, and the generated
  `src/integrations/supabase/types.ts` (schema, dropped in 4.5).
- Preserved and untouched: `ProfileRecommendations` (Recs tab, endorsement-backed),
  `posts.post_type='recommendation'`, `reviews.is_recommended`, the v4 entity page
  and its "N recommending (M from circle)" counts, the Circle card and its RPCs,
  `UserRecommendationCard`, `fallbackRecommendationService`,
  `networkRecommendationService`, chat/journey recommendation cards, the
  `hooks/recommendations/*` entity hooks, and the presentational
  `RecommendationCard`.
- `npx tsgo --noEmit` clean; 633/633 tests pass; build OK.

## Closure audit corrections (Gate 5, second pass)

The closure audit found two leftovers after the first pass. Both are fixed here.

### Leftover 1 — `RecommendationCard` still navigated to the retired route

Three navigations remained: card click fallback, and the comment-count button in
both the full and compact layouts (`?commentId=new`).

Root cause found by inspection: `reviewService.loadReviewSubjectEntities` selected
`id, name, type, image_url, is_deleted` — no `slug` — and the mapped `entity`
object omitted it too, while `RecommendationCard.getEntityRoute` returns `null`
without a slug. Every Recs-tab card therefore fell through to the retired route.
A blanket no-op would have left the whole tab unclickable, so the fix restores
the real destination instead:

- `SubjectRelationRow` gained an optional `slug`; `reviewService`'s subject
  lookup now selects `slug`, and `fetchUserRecommendations` maps `slug` and
  `is_deleted` onto `entity`. `Review.entity` typed accordingly. Additive only.
- `getEntityRoute` additionally refuses a soft-deleted subject.
- Card click navigates to the canonical entity page when a linked, live subject
  exists; a genuinely unlinked endorsement does nothing. No new route added.
- Both comment-count controls removed. This path hardcodes `comment_count: 0`
  and there is no review-discussion destination, so a disabled affordance would
  have implied functionality that does not exist. Likes and share untouched.
  Unused `MessageCircle` import removed.

Live data check (read-only): of 58 published endorsements, 20 have no
`entity_id` (legacy unlinked → correctly non-navigable), 0 have a missing or
slug-less subject, and 0 have a soft-deleted subject. So every linked card
routes to its entity page.

`RecommendationCard` has exactly one consumer, `ProfileRecommendations` (the
profile Recs tab); no other surface is affected.

### Leftover 2 — stale `supabase/functions/add_comment.sql`

Confirmed zero references anywhere in the repo (no imports, config, scripts,
tests, deployment inputs). Deleted. The authoritative post-only definitions of
`add_comment`, `update_comment`, `delete_comment`, `toggle_comment_like`,
`increment_comment_count` and both `get_comments_with_profiles` overloads live
in the Gate 1 write-freeze migration
(`supabase/migrations/20260915085556_a8c84270-f9b3-4069-a6d2-83351542804d.sql`),
which is the single source of truth for those routines.

### Record correction

An earlier Phase 4.3 note said the profile Recs tab would disappear. That is
factually wrong: only the retired standalone records disappeared. The tab is
**retained** as a review-endorsement surface (`ProfileRecommendations` →
`useRecommendations` → `reviewService.fetchUserRecommendations`, filtering
`reviews.is_recommended = true`, likes via `toggle_review_like`). It has zero
dependency on the retired tables and must not be removed in Phase 4.4/4.5.

### Re-verification

- Sweep for `/recommendations/` and `/recommendation/` across the repo: remaining
  hits are only module import paths (`@/services/recommendation/types`,
  `@/hooks/recommendations/*`), the explanatory comment in
  `notificationDestination.ts`, deliberate rejection cases in
  `notificationDestination.test.ts`, historical migrations, `docs/`, `roadmap.md`
  and the generated types file. No live navigation to the retired route.
- Recommendation-type posts unchanged: normal post destination path, post
  comments and likes unaffected (comment handling is post-only end to end).
- `reviews.is_recommended`, Entity V4 recommending/from-circle counts, the
  "Recommended by Your Circle" card, `UserRecommendationCard`,
  `fallbackRecommendationService`, `networkRecommendationService`,
  `ChatRecommendationCards`, `JourneyRecommendationCard`: unmodified.
- Browser check of `/u/hana.li?tab=recommendations` could not exercise the
  signed-in tab (external Supabase project — no test session can be minted); the
  guest gate rendered as expected. Navigation correctness is covered by the
  static + live-data checks above.
- `npx tsgo --noEmit` clean; 633/633 tests pass; build OK.

Gate 5 is complete with zero live legacy-route dependencies.
