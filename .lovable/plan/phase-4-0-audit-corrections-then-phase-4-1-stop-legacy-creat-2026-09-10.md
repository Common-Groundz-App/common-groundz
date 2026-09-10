# Phase 4.0 audit corrections, then Phase 4.1 (stop legacy creation)

Both reviewers are right on all counts, and I checked each point on disk:

- `UserRecommendationCard.tsx` is the "people to follow" card (suggested users, mutual-follow proof, Follow button, used by the feed). Not legacy. Wrongly listed for deletion.
- `RecommendationsModal.tsx` is the "Recommended by Your Circle / Similar to X" expansion, fed by the network/fallback entity services. Keep it; its data source gets rebuilt in 4.2.
- The review post type was never written into the concept table, so its isolation was asserted, not shown.
- No duplicate review button: the old "Recommend" button gets **removed**, not relabelled — the pages that have it already have their own "Write Review" action right beside it.
- No invented gate: `handleAddReview` uses `requireAuth()` only, and there is no `canCreateReviews` capability. Nothing new gets introduced.

**About your v4 page — you're right.** I confirmed `/entity/:slug` renders `EntityV4`, and v4 has no legacy Recommend CTA at all. Its header shows Follow + Write Review (exactly your screenshot), and its recommendation surfaces are the review-derived counts and the circle/entity modals. So v4 needs **no CTA change in 4.1**. The legacy button lives only in the older `EntityDetail` pre-v4 branch and in `EntityDetailV2`, and it is those two that get cleaned up.

## Step 1 — Correct the audit document

In `docs/verification/phase-4-recommendations-audit.md`:

1. Add a fourth concept row for `posts.post_type='review'` — an editorial label carrying its own optional `structured_fields.rating`, with no link to the reviews system. Evidence to record: the unified composer writes only to `posts` and `post_entities` (verified — no reviews, entity-stat or recommendation-intent writes anywhere in it), so a review post cannot move `reviews.is_recommended`, endorsement counts, entity ratings or trust.
2. Move `UserRecommendationCard.tsx` into a new "separate feature — keep" section with its real reason. Only any legacy scoring input inside `userRecommendationService` stays in 4.2 scope.
3. Move `RecommendationsModal.tsx` into "keep, migrate data source in 4.2", recording its path: `NetworkRecommendations` → `networkRecommendationService` / `fallbackRecommendationService` → modal → `RecommendationEntityCard`.
4. Record that the live entity page is v4 and carries no legacy creation CTA; the legacy CTA exists only in the pre-v4 `EntityDetail` branch and `EntityDetailV2`.
5. Add the gate rule as an explicit line: nothing is deleted for having "Recommendation" in its name — only for reading or writing `public.recommendations`.

## Step 2 — Phase 4.1: turn off legacy creation

- `src/pages/EntityDetail.tsx`: delete the "Recommend" button and `handleAddRecommendation`, leaving the existing "Write Review" action to occupy the row. Remove the mounted legacy form, its submit handler, the upload hook usage and the `createRecommendation` call.
- `src/pages/EntityDetailV2.tsx`: same removal.
- `src/components/feed/SmartComposerButton.tsx`: remove the dormant `open-recommendation-form` listener, the legacy submit handler, the upload hook and the mounted form. The Post option (which carries the Recommendation post type) and the Review option are unchanged.
- Untouched: `EntityV4` and everything under `entity-v4`, the unified composer, the structured review flow, and every legacy read path (old cards, lists, routes) — those belong to 4.2/4.3.
- `RecommendationForm.tsx`, `RecommendationCard.tsx`, `use-recommendation-actions.ts` and `crudOperations.ts` stay on disk, now dormant, until 4.3. Their internal listeners and references will still exist by design.

## Step 3 — Verification, stated as reachability

The proof is about what a user can reach, not about textual absence:

- No rendered component tree mounts `RecommendationForm` — every former mount site is removed, and no live code dispatches `open-recommendation-form`. The listener inside the dormant form itself remains and is unreachable because nothing renders it.
- No component in a reachable render path imports `createRecommendation`; remaining references live only in modules with no live importer, listed by name in the audit.
- The entity page shows exactly one review CTA — no side-by-side duplicate.
- Creating a post of type `recommendation` still works and still writes only `posts` + `post_entities`.
- Tests, typecheck and build all pass.
- Record the outcome in the audit doc and `roadmap.md`, then stop before 4.2 — no database or discovery changes.

## Out of scope

`posts.post_type='recommendation'` behaviour, the review recommendation resolver, discovery RPCs, dummy-data deletion, schema/enum cleanup, and the Phase 5 card redesign.
