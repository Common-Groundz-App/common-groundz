# Phase 4.3 — Gate 2: client + Edge Function cutover (evidence)

Date: 2026-09-15. Plan: approved Phase 4.3 revision 5, Gate 2.

## Governing rule applied

Nothing was removed because a name contains "recommendation" — only because it
read or wrote the legacy tables (`recommendations`, `recommendation_likes`,
`recommendation_saves`, `recommendation_comments`) or called the frozen
legacy RPCs.

## Feed

- `src/hooks/feed/api/feed.ts` — `fetchForYouFeed` / `fetchFollowingFeed` are
  posts-only; the legacy fetch + merge is gone. Signature and return shape
  (`{ items, hasMore }`) unchanged.
- `src/hooks/feed/types.ts` — legacy `FeedItem` / `RecommendationFeedItem`
  interfaces removed; `CombinedFeedItem = PostFeedItem`.
- `src/hooks/feed/interactions.ts` — `toggleFeedItemLike` / `toggleFeedItemSave`
  and `useInteractions` are post-only.
- `src/hooks/feed/use-infinite-feed.ts` — the realtime subscription to the
  legacy `recommendations` table removed (posts subscription kept).
- `src/hooks/feed/use-feed.ts` — dead legacy `itemType` branches removed.
- `src/components/feed/FeedItem.tsx` — renders `PostFeedItem` only.
- Deleted: `src/hooks/feed/api/recommendations.ts`,
  `src/hooks/feed/api/recommendations/interactions.ts`,
  `src/components/feed/RecommendationFeedItem.tsx`.

## Entity pages

- `src/services/entityService.ts` — `fetchEntityRecommendations` (legacy table
  + `get_recommendation_likes_by_ids` reads) removed. `fetchEntityReviews`,
  `calculateEntityRating`, `getEntityStats` (entity_stats_v2 +
  `get_circle_recommendation_count`) untouched.
- `src/hooks/use-entity-detail.ts`, `src/hooks/use-entity-detail-cached.ts` —
  no longer fetch legacy records; `recommendations` stays in the return shape
  as `[]` so page contracts are unchanged.
- Deleted `src/hooks/use-entity-data-cache.ts` (no importers).
- `src/pages/EntityDetail.tsx`, `src/pages/EntityDetailV2.tsx` — removed the
  unused legacy `RecommendationCard` import; the legacy list was not rendered
  (only logged). v4 entity page (`EntityV4`) untouched — it never consumed the
  legacy list.

## Search

- `supabase/functions/search-all/index.ts` — legacy table branch removed;
  `recommendations: []` in the response shape.
- `supabase/functions/unified-search-v2/index.ts` — same cutover.
- `src/pages/Search.tsx` — removed the dead `RecommendationResultItem` import
  and unused `RecommendationSearchResult` type import (the surface was already
  entities-only).
- Deleted `src/components/search/RecommendationResultItem.tsx`.

## Tombstone (stays until Gate 5)

- `src/pages/RecommendationView.tsx` — rewritten as a static controlled
  "no longer available" state: no legacy reads, `noindex`, same route
  (`/recommendations/:recommendationId`).
- `src/components/content/RecommendationContentViewer.tsx` — no longer mounted;
  the file itself is removed in Gate 5 together with the route and the legacy
  notification destination mappings (`contentRoutes`, `notificationDestination`
  keep the `recommendation` mapping until then so historical links resolve to
  the tombstone).

## Comments

- `src/services/commentsService.ts` — `fetchCommentCount` is post-only (no
  legacy table branch). The comment item-type unions remain for the unmounted
  tombstone viewer; the shared RPCs already reject legacy input server-side
  (Gate 1) and no live caller passes it. Final narrowing in Gate 5.

## Interactions / profile / misc

- Deleted `src/hooks/use-user-interactions-cache.ts` (no importers; read
  `recommendation_likes`).
- `src/services/enhancedUnifiedProfileService.ts` — removed dead
  `hasStrongNetwork` (legacy table read, `rating >= 4` gate, zero callers).
- `src/hooks/notifications/useNotificationTargets.ts` — post-only thumbnail
  chunks; legacy notifications resolve to no thumbnail.
- `src/components/recommendations/RecommendationCard.tsx` — kept as the
  presentational card (Recs profile tab); removed the owner delete affordance
  whose handler wrote the frozen legacy table with what are now review ids.
  `onDeleted` prop kept in the interface for caller compatibility.

## Legacy services and hooks removed

- Deleted `src/services/recommendation/crudOperations.ts`,
  `fetchRecommendationById.ts`, `fetchRecommendations.ts`,
  `interactionOperations.ts`.
- Deleted legacy hooks `use-recommendation-actions.ts`,
  `use-recommendation-filters.ts`, `use-recommendations-fetch.ts`,
  `use-recommendations.ts` under `src/hooks/recommendations/`.
- `src/services/recommendationService.ts` rewritten to re-export only the
  shared types, `uploadRecommendationImage` (still used by
  `use-recommendation-uploads.ts`) and `findOrCreateEntity` /
  `getEntitiesByType` (entity flows). Legacy CRUD/fetch exports and the
  legacy `toggleLike` are gone.

## Deliberately kept (preservation checklist)

- Recs profile tab (`ProfileRecommendations` → `use-recommendations.ts` →
  `reviewService.fetchUserRecommendations` → reviews with
  `is_recommended = true`) — endorsement-backed already.
- `posts.post_type = 'recommendation'` editorial posts, `reviews.is_recommended`.
- v4 entity page, its counts and Circle card
  (`get_circle_recommendation_count`, `get_circle_recommendation_counts_batch`,
  `get_aggregated_network_recommendations_discovery`, `has_network_activity`).
- `UserRecommendationCard`, `fallbackRecommendationService`,
  `networkRecommendationService`, chat/journey recommendation cards.
- `hooks/recommendations/use-entity-refresh.ts`, `use-entity-operations.ts`,
  `use-recommendation-uploads.ts` (entity/review helpers).
- Orphan-media functions still reference `recommendations.image_url` —
  removed in Gate 5 with the column reference sets.

## Verification

- Repo sweep: the only remaining legacy table access in `src/` is the
  unmounted tombstone viewer (Gate 5). No Edge Function reads the legacy
  tables except the orphan-media reference sets (Gate 5).
- `tsc --noEmit`: clean. Tests: 633/633 (38 files). Build: OK.
- DB: untouched in this gate — Gate 1 freeze ACLs/policies/grants as verified
  in `phase-4-3-gate-1-write-freeze.md`.
