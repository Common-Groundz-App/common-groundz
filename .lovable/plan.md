# Phase 4.2 (revised) — disconnect the old records from the app's intelligence

## Verification first — 4.0 and 4.1 are complete

Checked on disk: nothing imports or renders the old creation form, the only path to `createRecommendation` has no live caller, the old "Recommend" button is gone from both pre-v4 entity pages, `SmartComposerButton` offers exactly Post and Review, v4 is untouched, the Recommendation post type still writes only to `posts` + `post_entities`, and the audit carries the corrected classifications plus the "delete by data dependency, never by name" gate. Build green. No leftovers.

## What 4.2 does

4.1 stopped people creating old records. 4.2 stops the old records influencing anything the app calculates. Nothing is deleted — old screens, comments, notifications, routes and rows all keep working until 4.3.

Both reviews are accepted. Five corrections to the previous draft:

1. Comment plumbing moves **out of 4.2 into 4.3**. The old detail viewer still passes `itemType="recommendation"`, so removing that branch now would break comment reads on a page we promised keeps working.
2. Trending is **not** posts-only, and posts must be joined through `post_entities` — an unrelated post cannot move an entity's score.
3. Social influence stops using average rating as a proxy for influence (see the new calibration section).
4. Similarity needs a **minimum shared-entity threshold** and deterministic zero-variance handling.
5. `get_personalized_entities` has zero callers — it is **not rebuilt**; it is recorded dead and dropped in 4.5. Same for `calculate_trending_score` and `increment_comment_count`.

### Frozen semantics (applies to every routine below)

- **Endorsement** = `reviews.is_recommended`. Never re-derived from a rating threshold.
- **Current opinion / rating shown or ordered by** = `COALESCE(latest_rating, rating)` — the timeline-aware effective rating, confirmed present on `reviews`.
- **Eligibility** = published status only, entity not deleted, and an explicit visibility rule per routine (network routines may see circle content, global ones only public).
- **Editorial Recommendation posts never count as endorsement**, only as activity.
- Row-multiplying joins count distinct ids.

## Step 1 — Endorsement surfaces

- `get_network_entity_recommendations` — rebuilt: people you follow → their eligible reviews → `is_recommended` true. Inclusion by the flag, rating shown from the effective rating. Its signature still returns legacy category/visibility columns, so it is replaced, not patched.
- `get_fallback_entity_recommendations` — rebuilt on reviews: endorsement count, then average effective rating, then existing recency/popularity signal. No threshold-as-endorsement.
- `has_network_recommendations` — two conflicting overloads exist (one thresholds at 4, one at 3, confirmed in the catalogue). Collapse to one signature on the review flag and drop the other explicitly, so no client can bind the stale one.
- **Security, not an afterthought:** all three run as `SECURITY DEFINER` and take a user id. The rebuilt network routines derive the viewer from `auth.uid()` (or reject a mismatched id), so nobody can inspect another person's circle. Anonymous fallback stays separate. Old signatures dropped, execute grants restated, checked-in generated types refreshed, callers updated in the same change.
- Untouched, already review-based: `has_network_activity`, `get_recommendation_count*`, `get_circle_recommendation_count*`, both discovery aggregation routines.

**The v4 surfaces stay exactly as they are** — "7 recommending / 3 from circle", Recommenders, Circle Contributors, Recommended by Your Circle. Only what feeds them changes, and they get *more* correct: "recommends" finally means the person's actual answer, not "gave 4 rings".

## Step 2 — Activity and taste

- `calculate_enhanced_trending_score` — legacy inputs replaced with entity-linked activity: eligible posts linked via `post_entities` in 24h, plus likes on those posts in 24h, plus eligible reviews of the entity and likes on them in 24h. Existing weights and caps kept so ranking doesn't drift for an unrelated reason; the changed inputs are documented in the routine.
- `calculate_user_similarity` — Pearson over the two users' effective ratings of the *same* entities, eligible reviews only, with a documented minimum overlap below which the answer is "insufficient evidence" rather than a high score, and a fixed result when either side has zero variance. Existing normalisation/overlap penalty kept.
- `calculate_user_reputation` — remove only the legacy contribution branch. Reviews, posts and entities already count; nothing is added, so nothing double-counts.
- `get_personalized_entities`, `calculate_trending_score`, `increment_comment_count` — confirmed zero callers (app, edge function, trigger, job). Left untouched, recorded dead, dropped in 4.5.

## Step 3 — Social influence, rebuilt around calibration

Your instinct is right and it is the most interesting change in this phase: a person who rates everything five rings carries no information, and influence should not reward positivity. Average rating is dropped as an input.

The rebuilt score combines four honest factors:

1. **Reach** — followers.
2. **Contribution volume** — eligible published reviews (named as volume, not "recommendations").
3. **Engagement received** — likes on those reviews, via a left join so a review with zero likes still counts in the denominator.
4. **Calibration** — how closely the person's effective rating tracks each entity's consensus.

Calibration, with the guardrails that make it safe rather than a popularity tax:

- Consensus for an entity **excludes that user's own review**, otherwise everyone is partly compared to themselves.
- An entity only contributes when it has **enough independent raters**; a two-person entity has no consensus to agree with.
- Agreement is measured as average absolute distance from consensus, then inverted — so agreeing that something is bad counts exactly as much as agreeing it is good, which is the anti-manipulation property you want.
- A person needs a **minimum number of qualifying entities** before calibration applies at all; below that the factor is neutral, never punitive.
- **Rating spread matters too:** a user whose ratings have almost no variance (all fives) gets little calibration credit even if the average lines up, because agreeing by accident is not judgement.
- Calibration is **capped and modest in weight** — it adjusts influence, it never dominates. Being an early or minority voice on a thinly-rated entity must not be penalised, which is exactly what the independent-rater floor and the neutral fallback prevent.

Weights and thresholds are proposed with real numbers from the current data during implementation, and the before/after score for a fixed sample of users is recorded so the effect is visible rather than assumed.

## Verification before stopping

- Rebuilt routines: grants explicit, viewer identity enforced, a signed-in viewer gets results, an anonymous one gets only what policy allows, and no routine returns another user's private content.
- Circle / fallback / trending / similarity / influence: before-and-after numbers for the same fixed viewers and entities, recorded per surface.
- `reviews.is_recommended` unchanged across the whole table (before/after comparison) — 4.2 must not touch endorsement truth itself.
- Old detail page, its comments, notifications and route all still work.
- Recommendation and Review post types unaffected.
- Generated types refreshed; full check suite, typecheck and build green.
- Results appended to `docs/verification/phase-4-recommendations-audit.md`, roadmap ticked (including the new calibration item), then stop before 4.3.

## Out of scope

Legacy comment plumbing (4.3), deleting rows/routes/screens/enum (4.3–4.5), dead-routine removal (4.5), Phase 5 card work, and any change to how the review recommend answer itself is resolved.
