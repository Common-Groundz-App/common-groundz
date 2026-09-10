# Phase 4.0 — Standalone recommendation audit (read-only)

Date: 2026-09-09. Read-only: no code, schema or data was changed in this step.

## The three concepts (boundary rule)

| Concept | Where it lives | Status |
| --- | --- | --- |
| **Review recommend answer** — explicit questionnaire answer → latest timeline answer → rating fallback, materialised in `reviews.is_recommended` | `reviews`, `review_updates`, `resolve_review_recommendation`, `reviews_apply_recommendation`, `lookup_latest_recommendation_intent` | **NEW SYSTEM — the only endorsement truth. Untouched.** |
| **Recommendation post** — `posts.post_type='recommendation'`, an editorial label for contextual advice ("pair it with X", "only in cold weather") | `posts`, `postUtils.ts`, `EnhancedCreatePostForm`, `PostFeedItem` | **SEPARATE FEATURE — keep, untouched. Must never contribute to endorsement truth, counts, trust or ranking.** |
| **Review post** — `posts.post_type='review'`, an editorial label for prose about an experience, carrying its own optional `structured_fields.rating` | `posts`, `postUtils.ts`, `EnhancedCreatePostForm`, `PostFeedItem` | **SEPARATE FEATURE — keep, untouched. Its rating is post-local and must never write to or be read as `public.reviews`, entity ratings, endorsement counts or recommendation intent.** |
| **Standalone recommendation record** — old free-standing "Recommend this entity" object with its own rating, likes, comments, saves, views and detail page | `recommendations`, `recommendation_likes`, `recommendation_comments`, `recommendation_saves`, `recommendation_category` | **LEGACY — retire.** |

**Deletion gate (binding for 4.2–4.5):** nothing is removed because its name contains "Recommendation". A file, routine or column is a legacy target only if it reads or writes `public.recommendations` (or its dependent tables). "Recommendation" appears in 221 source files, the overwhelming majority of them personalisation, chat, journey, discovery and preference code that has nothing to do with the legacy table.

Verified isolation of both post types: `postUtils.ts` declares `DatabasePostType` including `'recommendation'` and `'review'`, and the unified composer (`src/components/feed/EnhancedCreatePostForm.tsx`) writes to exactly two destinations — `posts` and `post_entities`. It contains no write to `reviews`, no entity-stat write, no recommendation-intent write and no legacy table, RPC or category enum reference. A review post therefore cannot move `reviews.is_recommended`, endorsement counts, entity ratings or trust; its `structured_fields.rating` is display data on that post alone.

## Data (live, verified)

| Fact | Value |
| --- | --- |
| Legacy rows | 9 (single author, newest 2025-05-20, 4 linked to an entity) |
| Dependents | 20 likes, 17 comments, 3 saves, 16 notifications |
| Reviews | 78 total, 58 with `is_recommended` true |
| Reviews with `recommendation_id` | 6 — and exactly the same 6 have `is_converted` true |
| `recommendation_category` enum | `food, movie, book, place, product` (5 values) |
| TypeScript `RecommendationCategory` | invents 7 more (Drink, Activity, Music, Art, TV, Travel, Brand) that can never be stored — dead vocabulary |

All of it is dummy data, so no permanent legacy viewer will be built.

## Database routines — per-routine semantic classification

Endorsement (→ review flag), Engagement (→ post/review engagement or drop), Plumbing (branch on item type), Obsolete (drop with the tables).

| Routine | Legacy use | Client calls | Classification | Decision |
| --- | --- | --- | --- | --- |
| `calculate_trending_score` | recs + rec likes as 24h activity | **0** | Engagement, dead | **Drop** — superseded by `calculate_enhanced_trending_score` |
| `calculate_enhanced_trending_score` | recs + rec likes as 24h activity | 1 | Engagement | Replace both inputs with **post** engagement (posts created 24h, post likes 24h). Not the review flag — this measures activity, not endorsement. Keep `recent_recommendations_24h` column semantics or rename in 4.5 |
| `calculate_social_influence_score` | avg legacy rating, legacy count, legacy likes per rec | 1 | Mixed | Rebuild from `reviews` (avg rating, published count) + `review_likes`. Its "recommendation_count" means *contribution volume*, not endorsements |
| `calculate_user_reputation` | legacy rows as one of four contribution sources | **0** | Engagement | **Remove the legacy UNION branch only.** Reviews, posts and entities remain |
| `calculate_user_similarity` | Pearson correlation over legacy ratings | 2 | Engagement/taste | Rebuild over `reviews.rating` (published). Legacy version currently returns ~nothing with 9 rows |
| `get_fallback_entity_recommendations` | entities joined to legacy rows, rating ≥ 4 | 2 | **Endorsement** | Rebuild on `reviews` with `is_recommended` / `latest_rating` |
| `get_network_entity_recommendations` | legacy rows from followed users; fabricates `is_recommended` as `rating >= 4.0` | 1 | **Endorsement — worst offender** | Rebuild on `reviews.is_recommended`. Returns `recommendation_category` / `recommendation_visibility` in its signature, so it must be replaced, not patched, and its TS caller updated |
| `has_network_recommendations(p_entity_id, p_current_user_id, …)` | legacy rows, rating ≥ 4, public | 1 (one of the two overloads) | **Endorsement** | Rebuild on the review flag |
| `has_network_recommendations(p_user_id, p_entity_id, p_min_count)` | legacy rows, rating ≥ 3 | see above | **Endorsement** | Ambiguous overload pair — collapse to one signature |
| `has_network_activity` | **already reads `reviews.is_recommended`** | 1 | NEW SYSTEM | No change |
| `get_personalized_entities` | legacy rows from followed users, last 30 days | **0** | Engagement | Replace the `following_activity` CTE with posts (and/or reviews); or drop the routine, it has no caller |
| `increment_recommendation_view` | legacy view counter | 1 | Obsolete | Drop with the tables; remove the caller |
| `increment_comment_count` | branches on `'recommendations'` | **0** | Plumbing, dead | Drop |
| `add_comment`, `update_comment`, `delete_comment`, `toggle_comment_like`, `get_comments_with_profiles` | branch on `p_item_type='recommendation'` and build `/recommendations/:id` URLs | 1 each | Plumbing | **Remove only the recommendation branch**; the post branch is live and must not regress |
| `create_recommendation_like_notification`, `retract_recommendation_like_notification`, `create_recommendation_comment_notification` | legacy triggers | via triggers | Obsolete | Drop with the tables in 4.5 |
| `update_all_trending_scores` | orchestrates the trending routines | 2 | Plumbing | Follows whatever trending keeps |
| `get_recommendation_count`, `get_recommendation_counts_batch`, `get_circle_recommendation_count`, `get_circle_recommendation_counts_batch`, `get_network_recommendations_discovery`, `get_aggregated_network_recommendations_discovery`, `resolve_review_recommendation`, `reviews_apply_recommendation`, `lookup_latest_recommendation_intent` | none — review-flag based | — | NEW SYSTEM | No change |
| `get_recommendation_likes_by_ids`, `get_user_recommendation_likes`, `toggle_recommendation_like` | legacy like helpers | 4 / 0 / 0 | Obsolete | Drop with the legacy readers |

Naming trap recorded: `get_recommendation_count*` and `get_circle_recommendation_count*` **already** read the review flag. Do not "migrate" them.

## Application layer

**Creation entry points (LEGACY DEAD — removed in 4.1):** `src/components/feed/SmartComposerButton.tsx` (mounted the legacy form and listened for an `open-recommendation-form` window event), `src/pages/EntityDetail.tsx` and `src/pages/EntityDetailV2.tsx` (mobile "Recommend" button → legacy form). All three destinations were `RecommendationForm` → `recommendation/crudOperations.ts` → `public.recommendations`.

**Live entity page is v4.** `/entity/:slug` resolves through `getEntityPageVersion` and renders `components/entity-v4/EntityV4.tsx`. v4 has **no legacy creation CTA at all** — its header offers Follow and Write Review, and its recommendation surfaces are review-derived counts (`stats.recommendationCount`, `stats.circleRecommendationCount`) plus `EntityRecommendationModal`. So 4.1 changed no v4 CTA. The legacy button existed only in the pre-v4 `EntityDetail` branch and in `EntityDetailV2`; in both, an adjacent Review CTA already existed, so the legacy button was **removed** rather than relabelled — no duplicate review action was introduced, and no new verification capability was invented (`handleAddReview` uses `requireAuth()` only).

**Endorsement-relevant readers (switch to reviews — 4.2):**
- `src/services/entityService.ts` — `fetchEntityRecommendations`, `calculateEntityRating` (blends legacy ratings into the entity rating), `getEntityStats.recommendationCount`. Consumed by `use-entity-detail.ts`, `use-entity-detail-cached.ts`, `use-entity-data-cache.ts`. `calculateEntityRating` has no remaining caller outside the service.
- `src/components/entity-v4/NetworkRecommendations.tsx` — via `get_network_entity_recommendations`.
- `src/services/networkRecommendationService.ts`, `fallbackRecommendationService.ts` — follow their routines.

**Engagement/analytics readers (own decision, not the review flag — 4.2):** `socialIntelligenceService.ts` (4 legacy queries), `collaborativeFilteringService.ts` (6), `enhancedUnifiedProfileService.ts` (profile counts), `explore/UserDirectoryList.tsx` (activity counts), `feedContentService.ts` (new-content polling).

**LEGACY DEAD (delete — 4.3):** `components/recommendations/RecommendationForm.tsx`, `RecommendationCard.tsx`, `services/recommendation/crudOperations.ts`, `fetchRecommendations.ts`, `fetchRecommendationById.ts`, `interactionOperations.ts`, `imageUpload.ts`, `recommendationService.ts` legacy exports, `hooks/recommendations/*`, `hooks/feed/api/recommendations*`, `hooks/feed/interactions.ts` legacy branch, `components/feed/RecommendationFeedItem.tsx`, the legacy branch in `components/feed/FeedItem.tsx`, `pages/RecommendationView.tsx` + its route in `App.tsx`, `components/content/RecommendationContentViewer.tsx`, `components/profile/ProfileRecommendations.tsx`, `hooks/use-user-interactions-cache.ts` legacy branch, `hooks/notifications/useNotificationTargets.ts` legacy branch, `utils/contentRoutes.ts` `'recommendation'` route, `RecommendationCategory` and its hand-written maps in `services/recommendation/types.ts`, `types/entities.ts`, `hooks/feed/types.ts`, `entityService.ts`.

**Corrected classifications — SEPARATE FEATURE, KEEP (do not delete):**
- `src/components/feed/UserRecommendationCard.tsx` — the "people you may want to follow" card. Backed by `userRecommendationService` (`RecommendedUser`, `logUserImpression`), shows mutual-follow proof and a Follow button, rendered by `src/pages/Feed.tsx`. It never touches `public.recommendations`. Only any legacy scoring input inside `userRecommendationService` is in 4.2 scope.
- `src/components/modals/RecommendationsModal.tsx` — the "Recommended by Your Circle / Similar to X" expansion. Data path: `components/entity-v4/NetworkRecommendations.tsx` → `networkRecommendationService` / `fallbackRecommendationService` (RPCs `get_network_entity_recommendations`, `get_fallback_entity_recommendations`) → modal props → `components/entity/RecommendationEntityCard`. It renders entities, not legacy rows. **Keep it and migrate its backing RPCs to the review flag in 4.2**; it is not a 4.3 deletion target.

**Edge functions with legacy reads:** `unified-search-v2`, `search-all` (legacy search result type), `cleanup-orphan-media`, `cleanup-orphan-media-execute` (legacy `image_url` scan).

**Deployment-safety note (why 4.3 merges route + data removal):** 16 notifications point at `/recommendations/:id`, and `add_comment` mints that URL. Deleting the route in one step and the notifications in a later step would ship dead links. They go together. Likewise `reviews.recommendation_id` and `reviews.is_converted` are cleared in the same statement — the same 6 rows hold both, and a review must not claim a conversion it can no longer name.

**Not in scope, explicitly:** `posts.post_type='recommendation'` (composer, `postUtils.ts`, badge, feed rendering), all chat/journey/preference/personalisation "recommendation" naming, `MyStuff` journey recommendation cards, `entityRecommendationService.ts`, `userRecommendationService.ts`, `journeyRecommendationService.ts`.

## Rating source for review posts (confirms Phase 5.3)

`StructuredFields.rating` exists on posts, is declared under the Review group, and is populated: of 4 published review posts, 3 carry a rating; no other post type carries one. So a review post's rings render **that post's own `structured_fields.rating`** — no review lookup, no entity aggregate, no inference, no new state. When absent, the row does not render. Recommendation, tip and experience posts get no rating row at all.

## Design capture — the legacy card, as reference only

Reference screenshots supplied by the product owner live in `docs/verification/assets/`.

Anatomy worth keeping (`recommendation-card-legacy.png`):

```text
padding
  avatar | name @handle            [ Place ]   ← type badge, top-right
         date
  Title (large, own line)
  Secondary context line (venue/address, muted)
  ◎◎◎◎○ 4.0                                   ← rating, immediately visible
  Body
  [ entity chip ]
  media (full width, breathing room above/below)
  ♡ 1   💬 2                                   ← isolated action row
```

- Generous outer padding; every idea owns a zone with real space between zones.
- Rating is scannable without reading.
- Top-right badge balances the header.
- Action row visually separated from content.

Faults not to copy: excessive total height; text-only cards would inherit far too much empty space; the title duplicates the entity chip; the badge is an **entity** type sitting where a **content** type belongs; the component is welded to the legacy schema, its own delete behaviour and fallback images — so Phase 5 builds fresh from these notes, never from this component.

Current post card (`post-card-compact-review.png`, `post-card-compact-recommendation.png`): post type sits inline beside the date, title/body/chips stack with almost no separation, no rating on review posts, tight action row. Badge relocation is the biggest single win but not sufficient on its own — the vertical rhythm is the real problem.

## Gate

4.0 is delivered. Nothing removed. 4.1 begins only after this audit is reviewed.
