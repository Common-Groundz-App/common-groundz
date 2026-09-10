# Phase 4.0 / 4.1 verification, then Phase 4.2

## Verification result — 4.0 and 4.1 are complete, no leftovers

Checked on disk, not from memory:

- **No reachable path to the old creation form.** `RecommendationForm.tsx` is only referenced by itself; nothing imports it, nothing renders it, and no live code dispatches `open-recommendation-form`. `createRecommendation` is reached only from `use-recommendation-actions.ts`, which has no importer.
- **The old "Recommend" button is gone** from the pre-v4 `EntityDetail` branch and from `EntityDetailV2`; each page keeps its single existing review action. `SmartComposerButton` now offers exactly Post (to `/create`) and Review.
- **v4 untouched**, as agreed — it never had a legacy creation button.
- **The Recommendation post type is untouched** and still writes only to `posts` + `post_entities`.
- The audit document carries the corrected classifications (suggested-people card and the Circle popup marked keep), the review-post isolation row, the "delete by data dependency, never by name" gate, and the 4.1 result. Roadmap marks 4.0 and 4.1 done.
- Build is green.

Nothing from 4.0/4.1 is outstanding. Proceeding to 4.2.

## Phase 4.2 — make every consumer read the right source

4.2 changes **calculations only**. No legacy row, table, column or route is deleted (that is 4.3/4.5), and the old read-only screens keep working until then. Each change is applied per consumer with a recorded before/after number — no find-and-replace.

### Step 1 — Endorsement surfaces (the ones users see)

These currently invent endorsement from the old records, mostly as "rating 4 or more". They must read the review recommend answer instead.

- `get_network_entity_recommendations` — rebuild on `reviews.is_recommended` for people you follow. It currently returns legacy category/visibility columns in its signature, so it is replaced with a new signature, not patched, and `networkRecommendationService.ts` + the "Recommended by Your Circle" popup are updated to the new shape.
- `get_fallback_entity_recommendations` — rebuild on `reviews` (`is_recommended`, `latest_rating`, published only) instead of the legacy join.
- `has_network_recommendations` — two conflicting overloads exist today (one thresholds at rating 4, the other at 3). Collapse to a single signature reading the review flag, and drop the redundant overload so no caller can bind the wrong one.
- Leave alone, verified already review-based: `has_network_activity`, `get_recommendation_count*`, `get_circle_recommendation_count*`, and both discovery aggregation routines.

Recorded per surface: how many entities each returned before and after, for the same viewer and entity.

### Step 2 — Engagement and taste calculations

These measure activity, not endorsement, so they move to posts/reviews rather than to the recommend flag.

- `calculate_enhanced_trending_score` — replace the legacy-row and legacy-like inputs with posts created in 24h and post likes in 24h. Column naming is left for 4.5.
- `calculate_social_influence_score` — rebuild from `reviews` (average rating, published count) plus review likes; its "count" means contribution volume.
- `calculate_user_reputation` — remove only the legacy contribution branch; reviews, posts and entities stay.
- `calculate_user_similarity` — recompute taste correlation over `reviews.rating` (published). The legacy version returns almost nothing anyway.
- `get_personalized_entities` — no caller; replace its legacy activity source with posts, or drop it (decide in-step, record which).
- `calculate_trending_score` (superseded, no caller) and `increment_comment_count` (dead legacy branch) — leave on disk, retire in 4.5 with the rest.

Recorded: score for a fixed sample of users/entities before and after, so a change of ranking is visible rather than assumed.

### Step 3 — Comment plumbing

`add_comment`, `update_comment`, `delete_comment`, `toggle_comment_like`, `get_comments_with_profiles` each branch on item type. Remove **only** the recommendation branch and the `/recommendations/:id` link minting inside them. The post branch is live and must not regress — post comment create/edit/delete/like is retested explicitly.

Old notification rows still pointing at `/recommendations/:id` are left alone here; they are removed in 4.3 together with the route, so no dead link is ever shipped.

### Step 4 — Client callers

Update only the callers whose RPC signature changed (`networkRecommendationService.ts`, `fallbackRecommendationService.ts`, and the Circle popup's card props). The legacy read services (`fetchRecommendations`, `fetchRecommendationById`, `interactionOperations`, `entityService`'s legacy blocks, `socialIntelligenceService`, `collaborativeFilteringService`, `feedContentService`, `enhancedDiscoveryService`, `enhancedUnifiedProfileService`) are **not** touched in 4.2 — they belong to 4.3 with the rows they read.

### Verification before stopping

- Every rebuilt routine has explicit grants and runs as intended; a signed-in viewer gets results, an anonymous one gets only what policy allows.
- "Recommended by Your Circle" and the fallback strip still render, now sourced from review answers; before/after counts recorded.
- Post comments unaffected; Recommendation and Review post types unaffected; `reviews.is_recommended` values unchanged by this phase (whole-table before/after comparison).
- Full check suite, typecheck and build green.
- Results appended to `docs/verification/phase-4-recommendations-audit.md`, roadmap ticked, then stop before 4.3.

## Out of scope

Deleting legacy rows, tables, columns, routes, screens or the category enum; the Phase 5 card redesign; anything touching the review recommend answer itself.
