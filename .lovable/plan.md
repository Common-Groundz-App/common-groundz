# Phase 4.0 audit corrections, then Phase 4.1 (stop legacy creation)

Both reviewers are right, and I checked each claim on disk before agreeing:

- `UserRecommendationCard.tsx` imports `userRecommendationService`, shows mutual-follow proof and a Follow button, and is used by the feed. It is the "people to follow" card — nothing to do with the old standalone records. Wrongly listed as delete-me.
- `RecommendationsModal.tsx` takes network/fallback entity recommendations as props from `NetworkRecommendations` and renders entity cards. It is the "Recommended by Your Circle / Similar to X" expansion. It should survive and get its data rebuilt in 4.2, not be deleted.
- The review post type was never written into the concept table, so its isolation was asserted rather than shown.

So: fix the audit first (it is the deletion authority for later steps), then do only 4.1.

## Step 1 — Correct the audit document

In `docs/verification/phase-4-recommendations-audit.md`:

1. Add a fourth row to the concept table for `posts.post_type='review'` — an editorial label with its own `structured_fields.rating`, no connection to the reviews system. Evidence to record: the composer writes only to `posts` and `post_entities` (verified — no reviews, entity-stat or recommendation-intent writes anywhere in it), so a review post cannot change `reviews.is_recommended`, endorsement counts, entity ratings or trust.
2. Move `UserRecommendationCard.tsx` out of the delete list into a new "separate feature — keep" section, with the reason (suggested users, `userRecommendationService`, used by the feed). Note that only any legacy scoring input inside its service is in scope for 4.2.
3. Move `RecommendationsModal.tsx` out of the delete list into "keep, migrate data source in 4.2", with its real data path: `NetworkRecommendations` → `networkRecommendationService` / `fallbackRecommendationService` → modal → `RecommendationEntityCard`.
4. Add the naming rule as an explicit gate line: nothing gets deleted because its name contains "Recommendation" — only because it writes to or reads from `public.recommendations`.

## Step 2 — Phase 4.1: turn off legacy creation only

Entry points that currently open the legacy form:

- `src/pages/EntityDetail.tsx` (the live `/entity/:slug` page) — button labelled **Recommend** at line ~773.
- `src/pages/EntityDetailV2.tsx` — same button.
- `src/components/feed/SmartComposerButton.tsx` — no visible menu item any more, but still listens for an `open-recommendation-form` window event and still holds the legacy submit handler.

Changes:

- Entity pages: the CTA no longer says "Recommend" while opening a review. Relabel it **Write a review** and point it at the existing entity-first review flow (the same flow the page's own review action already uses). Keep the verification gate, swapping `canCreateRecommendations` for the review capability the review CTA already checks.
- Remove the legacy form mounting, its submit handler, the `useRecommendationUploads` usage and the `createRecommendation` call from all three files. Existing lists of old recommendations on the entity pages stay untouched in 4.1 — read paths belong to 4.2/4.3.
- `SmartComposerButton`: delete the `open-recommendation-form` listener and the legacy submit path. The Post option (which offers the Recommendation post type) and the Review option are unchanged.
- Leave `RecommendationForm.tsx`, `RecommendationCard.tsx` and `services/recommendation/crudOperations.ts` on disk, now unreferenced, until 4.3 — as planned.

## Step 3 — Verify, then stop

- Search proof: no reachable code path renders `RecommendationForm` or calls `createRecommendation`; no `open-recommendation-form` dispatcher or listener remains.
- Composer proof: creating a post with type `recommendation` still works and still writes only `posts` + `post_entities`.
- Run the test suite, typecheck and build.
- Record the result in the audit doc and `roadmap.md`, then stop before 4.2 (no database work, no discovery changes).

## Out of scope in this phase

`posts.post_type='recommendation'` behaviour, the review recommendation resolver, discovery RPCs, dummy-data deletion, schema/enum cleanup, and the Phase 5 card redesign.
