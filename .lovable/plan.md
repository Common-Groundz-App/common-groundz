# Phase 4.2A first — recommendation-truth migration

## Decision

Adopt both reviews. Do **not** implement the prior all-in-one 4.2.

Split the work:

- **4.2A — correctness and security:** disconnect active endorsement surfaces from the old standalone records, preserve the v4 UI, verify, then stop.
- **4.2B — intelligence formulas:** migrate trending, similarity, influence and reputation only after their behavior is separately frozen and approved.
- **Calibration experiment:** keep the leave-one-out, confidence-weighted idea, but do not ship it as part of legacy retirement.

This is safer because 4.2A changes where an existing truth comes from; 4.2B changes product ranking and trust policy.

## Important findings added to the plan

- The v4 `NetworkRecommendations` component does **not** call the older `get_network_entity_recommendations`; it calls `get_aggregated_network_recommendations_discovery`, which already reads published `reviews.is_recommended`.
- That active aggregated routine still uses raw `reviews.rating`, accepts an arbitrary `p_user_id` inside a `SECURITY DEFINER` function, and has no explicit review-visibility condition. It therefore needs effective-rating, identity and visibility hardening even though its endorsement source is already modern.
- The active fallback path still calls `get_fallback_entity_recommendations`, which reads the old standalone records.
- The older `get_network_entity_recommendations` and `has_network_recommendations` client wrappers currently have no external caller. They must not be rebuilt just because their names match; confirm no SQL/Edge Function/scheduled caller, then classify them for 4.5 deletion.
- The similarity and influence services are live through discovery/personalization, and their client pipelines query the old table directly. Replacing only their RPCs would be incomplete.
- Trending is invoked through `update_all_trending_scores` by an Edge Function, and its candidate selector also reads the old table. Formula and candidate migration must happen together in 4.2B.

# Phase 4.2A implementation

## 1. Freeze the authorization matrix

Use one exact rule for every active replacement routine:

| Surface | public review | circle-only review | private review |
| --- | --- | --- | --- |
| Anonymous/global fallback | yes | no | no |
| Signed-in global fallback | yes | no | no |
| Signed-in viewer's Circle | yes, when author is followed | yes only when the repository's existing Circle authorization rule allows that viewer | no |
| Review owner-only surface | as needed | as needed | own row only |

Before SQL, identify and reuse the existing Circle authorization rule. Following alone must not silently become permission to read circle-only content unless that is already the product's established rule.

For every `SECURITY DEFINER` Circle RPC:

- derive the viewer from `auth.uid()`, or reject when a retained `p_user_id` differs;
- authenticated execution only;
- explicit `search_path`, owner and grants;
- no reliance on RLS inside the definer body;
- tests for self, mismatched identity, anonymous call and visibility boundaries.

## 2. Migrate the active fallback surface

Rebuild `get_fallback_entity_recommendations` from eligible public reviews:

- inclusion/count = `reviews.is_recommended = true`;
- displayed/ordered rating = `COALESCE(latest_rating, rating)`;
- `status = 'published'`, linked entity required, deleted entities excluded;
- public reviews only;
- exclude the current entity and entities already reviewed by the signed-in viewer where the existing behavior requires it;
- keep the return shape needed by `NetworkRecommendations` / `RecommendationsModal`, without legacy category or visibility enum fields.

Update the fallback client mapping and generated Supabase types in the same deployment unit.

## 3. Harden the active v4 Circle pipeline without redesigning it

For `get_aggregated_network_recommendations_discovery`:

- keep `reviews.is_recommended` as the inclusion truth;
- replace raw `rating` with effective rating;
- apply the frozen visibility rule;
- enforce viewer identity;
- retain current returned entity/profile fields and ordering unless a field was legacy-only;
- preserve `NetworkRecommendations`, `RecommendationsModal`, and `RecommendationEntityCard` visually.

Audit the other active v4 Circle RPCs (`has_network_activity`, `get_circle_rating`, `get_circle_recommendation_count*`) for the same identity/visibility issue. Change only routines that fail that audit; record every no-change decision.

## 4. Retire rather than rebuild unused legacy RPCs

Confirm across TypeScript, Edge Functions, SQL-to-SQL calls, triggers and scheduled jobs that these are uncalled:

- `get_network_entity_recommendations`;
- both `has_network_recommendations` overloads.

If confirmed, leave them untouched in 4.2A and mark them for deletion in 4.5. If a real caller is found, migrate that complete caller path before classifying the routine.

This replaces the earlier proposal to modernize dead functions.

## 5. Deployment and compatibility contract

- Migration explicitly drops/replaces only changed signatures.
- Restate execute grants after each replacement.
- Refresh generated Supabase types; never hand-edit them.
- Update all callers in the same phase.
- Do not leave a stale overload that old clients can bind accidentally.
- Preserve return-column compatibility where practical; if it must change, deploy the replacement routine and caller as one reviewed unit.

## 6. 4.2A verification and stop gate

- Record before/after result counts and representative rows for the same viewer/entity on the v4 Circle and fallback surfaces.
- Verify the visible v4 surfaces remain: recommending count, Circle count, Recommenders, Circle Contributors and Recommended by Your Circle.
- Verify effective ratings appear after timeline updates.
- Verify identity mismatch and unauthorized visibility are denied.
- Prove the surviving paths do not depend on `public.recommendations` in two ways:
  1. dependency/source scan of every active routine and client path;
  2. rollback-only SQL fixture test that invokes them with modern review fixtures while legacy recommendation rows are unavailable/empty, leaving production data unchanged.
- Whole-table before/after parity for `reviews.is_recommended`; 4.2A consumes truth but never changes it.
- Old detail page, comments, notifications, route and dummy rows still work.
- Recommendation and Review post types unchanged.
- Full tests, typecheck and build pass.
- Append evidence to the Phase 4 audit, mark **4.2A only** complete in the roadmap, then stop for review before 4.2B.

# Phase 4.2B — specification first, no implementation yet

A separate plan will trace and migrate complete pipelines, not RPCs alone:

- `CollaborativeFilteringService` candidate discovery, exclusion, result selection and similarity RPC;
- `SocialIntelligenceService` category discovery, candidate/result selection and influence RPC;
- trending calculator **and** `update_all_trending_scores` candidate selector;
- conservative removal of the legacy branch from user reputation;
- dead routines left for 4.5.

Before coding, freeze machine-readable fixtures and exact behavior for:

### Similarity

- effective ratings on the same eligible entities;
- exact minimum overlap;
- `NULL` versus `0` for insufficient evidence (including caller behavior);
- zero-variance result;
- overlap-confidence weighting and score range.

### Trending

Use three grouped signals to preserve the old 0.5 / 0.3 / 0.2 structure while removing legacy inputs:

- 0.5 recent entity views;
- 0.3 distinct engagement = post likes + review likes on eligible entity-linked contributions;
- 0.2 distinct contributions = linked posts + reviews.

Freeze time decay, caps, deduplication and distinct-active-user protection before implementation. Update candidate selection to include views, linked posts, reviews and their engagement — never the old table.

### Influence

For 4.2B retirement work, use a minimal model with documented, approved weights:

- reach;
- eligible contribution volume;
- engagement received;
- **no average-rating/positivity factor**.

Your calibration idea becomes a separately evaluated extension:

```text
calibration evidence = leave-one-out agreement × consensus confidence
```

It must freeze and test independent-rater minimum, qualifying-entity minimum, consensus dispersion/polarization, personal rating variance, neutral sparse-data behavior, maximum bonus/penalty and all weights. Evaluate it offline against fixtures for paid all-five behavior, honest minority/contrarian views, polarized entities, early reviewers and sparse users before deciding whether it belongs in production.

## Out of scope for 4.2A

All scoring/ranking redesign, legacy comments, old screens/routes/rows, category enum/schema deletion, dead-routine deletion and Phase 5 cards.
