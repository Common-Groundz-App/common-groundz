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

## 0. Three amendments from review (accepted)

### 0a. Deployment safety — expand, switch, verify, contract

Where an active routine's callable contract changes (name, arguments, or returned columns), the old contract is never dropped before the new client path is live:

```text
add hardened routine -> verify it alone -> switch callers -> verify live path -> retire old contract
```

In-place replacement is allowed only when the externally observable contract stays compatible. Confirmed correction: the fallback routine's current contract is eight plain columns (`entity_id`, `entity_name`, `entity_type`, `entity_image_url`, `entity_slug`, `avg_rating`, `recommendation_count`, `display_reason`) — no legacy category/visibility fields; those belonged to other old contracts. So the fallback takes the in-place route: same signature, same return shape, body swapped from old records to reviews. Its unused `p_current_user_id` stays accepted-but-ignored for now and is removed with the contract cleanup in 4.5, avoiding a pointless overload and cutover.

### 0b. Correct the stale v4 explanations (confirmed on disk)

Three places still tell people a rating threshold decides endorsement, which stopped being true in Phase 3C:

- `src/components/entity-v4/EntityHeader.tsx:566` — "Reviews with 4 or more circles are considered recommendations."
- `src/components/entity-v4/TrustSummaryCard.tsx:135` — "Percentage of people you follow who rated this 4 or more circles."
- `src/components/content/PostDetailSidebar.tsx:242` — the same threshold sentence.

Layout untouched; wording only. It should say the reviewer's own answer decides it, and the rating is used only when they didn't answer. Making the numbers correct while leaving a false explanation on screen is not acceptable.

### 0c. Fallback is frozen as a global public surface

Confirmed: `get_fallback_entity_recommendations` takes a current-user argument and never uses it; the v4 component passes a user id while the client service passes null. So there is no viewer-specific behavior to preserve, and adding one now would be a new personalization decision that makes the two callers disagree. Frozen meaning for this phase: global, public reviews only, endorsement-based, viewer-independent, excluding only the current entity plus the existing entity-eligibility rules. The unused argument remains accepted-but-ignored (no behavior change) and is deleted in 4.5 with the other stale contracts.

### 0d. One person, one endorsement — and the database does not enforce it

Checked, and this is a real gap rather than a theoretical one: `reviews` has no unique index on (user_id, entity_id) — only the primary key — and there are already **2** published (person, item) pairs carrying more than one review row.

So every people-oriented surface must deduplicate rather than assume. **Frozen order of operations — this is the part that must not be improvised:**

```text
per surface, per (user_id, entity_id):
  1. restrict to published reviews this audience/viewer is authorized to see
  2. within those visible rows pick the canonical one:
     ORDER BY created_at DESC NULLS LAST, id DESC
  3. read is_recommended on that chosen row (endorsement surfaces)
  4. take COALESCE(latest_rating, rating) from that same chosen row
```

Three things this ordering deliberately gets right:

- **Endorsement is never filtered first.** If someone's older review said yes and their newer one says no, filtering to `is_recommended = true` before selecting would keep the stale yes and report them as a current recommender.
- **Visibility is applied *before* selection, not after.** Each audience sees the latest opinion available *to that audience*. A newer private review must not silently erase an older public recommendation — that would make visibility a hidden input into public results and open a small side channel. If we ever want "any newer review supersedes older public ones", that is a separate product decision, not Phase 4 cleanup.
- **`NULLS LAST`** because `created_at` is nullable; without it a null-timestamped row would sort first in Postgres and hijack the canonical position.

Drafts never supersede the current published row.

Consequences:

- counts count **endorsing people**, not review rows;
- averages use only the chosen rows, so one person with several reviews cannot pull the average;
- recommender lists show each person once;
- endorsement and rating always come from the *same* row.

**Shared selection, not shared filtering.** Every surface agrees on which row is canonical; what they do next differs:

| Surface | canonical visible row | then |
| --- | --- | --- |
| recommending count / Recommenders / Circle count | yes | require `is_recommended = true` |
| Circle rating / average rating | yes | use the effective rating regardless of the answer |

Someone who rates 2 rings and answers "no" belongs in the Circle rating but not in "3 recommending". `get_circle_rating` must not quietly become a recommenders-only average.

Adding a unique (user_id, entity_id) constraint is not part of this phase — the existing duplicate rows would need reconciling first, and whether one person may hold only one structured review per item is a separate product decision that also has to answer what happens to each duplicate's likes, timeline updates and media.


### 0e. Every people-oriented surface, not just the three named ones

Confirmed additional surfaces that currently treat one row as one person:

- `get_recommendation_counts_batch` — counts rows with `COUNT(*)` and has **no public-visibility filter** even though anonymous callers can execute it. Both faults fixed here.
- `get_recommendation_count` — used for an entity's visible count; audited under the same rule.
- `src/services/entityRecommendationService.ts` (`getEntityRecommendersWithContext`) — selects every matching review row and maps each to a profile, so a person with two endorsed reviews appears twice. Worse, it applies limit/offset to review rows before any dedupe, which makes page sizes unstable. Canonical selection must happen in SQL before limit/offset, not in client code afterwards.

All of these must share one canonical selection with the Circle and fallback surfaces, so the recommending count, Recommenders list, Circle Contributors, Circle counts and fallback cards can never disagree.

Fixture coverage:

- one person, two eligible endorsing reviews of the same item → appears once, counts once, one rating in the average;
- one person, older review yes and newer review no → does not appear and does not count;
- paginated Recommenders list returns stable, distinct people.




## 1. Freeze the authorization matrix

Use one exact rule for every active replacement routine:

| Surface | public review | circle-only review | private review |
| --- | --- | --- | --- |
| Anonymous/global fallback | yes | no | no |
| Signed-in global fallback | yes | no | no |
| Signed-in viewer's Circle | yes, when author is followed | yes only when the repository's existing Circle authorization rule allows that viewer | no |
| Review owner-only surface | as needed | as needed | own row only |

**Hard gate before any SQL:** state the exact relationship `circle_only` authorizes, with evidence from this codebase. If no stable rule is already established, Circle aggregation includes public reviews only for this phase. Following alone must not silently become permission to read circle-only content, and a definer routine must never widen visibility on an assumption.

For every `SECURITY DEFINER` Circle RPC:

- derive the viewer from `auth.uid()`, or reject when a retained `p_user_id` differs;
- authenticated execution only;
- explicit `search_path`, owner and grants;
- no reliance on RLS inside the definer body;
- tests for self, mismatched identity, anonymous call and visibility boundaries.

## 2. Migrate the active fallback surface

Rebuild the **body** of `get_fallback_entity_recommendations` from eligible public reviews, keeping the contract exactly as callers know it (see 0a/0c):

- inclusion/count = `reviews.is_recommended = true`;
- displayed/ordered rating = `COALESCE(latest_rating, rating)`;
- `status = 'published'`, linked entity required, deleted entities excluded;
- public reviews only;
- exclude the current entity only — no viewer-specific exclusion;
- canonical selection per 0d applied in the frozen order (latest published row, then visibility, then endorsement, rating from that same row);
- same signature and same eight return columns; `p_current_user_id` still accepted and still ignored.

Because the contract is unchanged, this is a single in-place replacement — no new overload, no caller cutover, no generated-types churn for this routine.

## 3. Harden the active v4 Circle pipeline without redesigning it

For `get_aggregated_network_recommendations_discovery`:

- keep `reviews.is_recommended` as the inclusion truth;
- replace raw `rating` with effective rating;
- apply the frozen visibility rule;
- enforce viewer identity;
- apply the 0d canonical selection in the frozen order, for both the recommender list and the average;
- retain current returned entity/profile fields and ordering unless a field was legacy-only;
- preserve `NetworkRecommendations`, `RecommendationsModal`, and `RecommendationEntityCard` visually.

Audit the other active v4 Circle RPCs (`has_network_activity`, `get_circle_rating`, `get_circle_recommendation_count*`) for the same identity, visibility and one-person-one-endorsement issues. Change only routines that fail that audit; record every no-change decision. Counts, ratings, summary and modal must all agree on which reviews qualify.

## 3b. Global counts and the Recommenders list (per 0e)

- `get_recommendation_counts_batch` — count distinct endorsing people, and add the missing public-visibility filter for its anonymous callers.
- `get_recommendation_count` — audited and aligned to the same rule.
- `getEntityRecommendersWithContext` — canonical selection moved into SQL ahead of limit/offset so pages are stable and each person appears once. Existing filters, sorting and returned fields are preserved.

## 4. Retire rather than rebuild unused legacy RPCs

Confirm across TypeScript, Edge Functions, SQL-to-SQL calls, triggers and scheduled jobs that these are uncalled:

- `get_network_entity_recommendations`;
- both `has_network_recommendations` overloads.

If confirmed, leave them untouched in 4.2A and mark them for deletion in 4.5. If a real caller is found, migrate that complete caller path before classifying the routine.

This replaces the earlier proposal to modernize dead functions.

## 5. Deployment and compatibility contract

- Contract-compatible changes may be replaced in place; contract-breaking ones follow 0a.
- Restate execute grants after each replacement; revoke default access.
- Refresh generated Supabase types; never hand-edit them.
- Retire stale overloads once no live client can bind them.
- Explicit owner and `search_path` on every touched routine.

## 6. 4.2A verification and stop gate

- Record before/after result counts and representative rows for the same viewer/entity on the v4 Circle and fallback surfaces.
- Verify the visible v4 surfaces remain: recommending count, Circle count, Recommenders, Circle Contributors and Recommended by Your Circle.
- Verify effective ratings appear after timeline updates.
- Verify identity mismatch and unauthorized visibility are denied.
- All three stale explanations from 0b corrected and checked on screen. Frozen wording: "Recommendation uses the reviewer's latest explicit choice when available. Otherwise it's based on their current rating." This stays true for a deliberate reset to rating, which the earlier draft wording wrongly described as never having answered.
- 0d/0e fixtures pass: duplicate endorsing reviews count once; older yes plus newer no does not count or appear; paginated Recommenders returns stable distinct people; anonymous batch counts expose public reviews only.
- Prove the surviving paths do not depend on `public.recommendations` in two ways:
  1. dependency/source scan of every active routine and client path;
  2. a transaction-scoped fixture test, rolled back, that invokes them with modern review fixtures while no legacy rows are visible to the query. The real legacy table is never dropped or emptied to prove independence.
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
