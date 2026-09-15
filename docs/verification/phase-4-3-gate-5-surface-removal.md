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
