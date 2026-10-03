# Review Lifecycle Step 1 — one review per person per subject

Date: 2026-10-03. Project uyjtgybbktgapspodajy.

## Production (read-only checks + one migration)
- Pre-check: `select user_id, entity_id, count(*) from reviews where entity_id is not null group by 1,2 having count(*)>1;` → 0 rows.
- Migration: `CREATE UNIQUE INDEX reviews_one_per_user_entity ON public.reviews (user_id, entity_id) WHERE entity_id IS NOT NULL;`
- Catalog check: `pg_indexes` → `CREATE UNIQUE INDEX reviews_one_per_user_entity ON public.reviews USING btree (user_id, entity_id) WHERE (entity_id IS NOT NULL)`.
- RLS read policy confirmed: `visibility = 'public' OR user_id = auth.uid()` — owners read all their own reviews.
- No test writes on production. True two-session concurrency: UNVERIFIED (no isolated database).

## Code
- `src/services/review/ownReview.ts` — `findOwnReviewForEntity(entityId, { excludeReviewId? })` (owner from session; found / none / error) and `isOwnReviewUniqueViolation` (23505 naming this index only).
- `ReviewForm` — checks every new subject (create; edit only when the subject changes, excluding itself). Next/Publish blocked unless a confirmed "none" for the current subject. Notice: checking / already reviewed (Add an update → `/entity/<id>?compose=update`, Cancel) / failed (Try again). Race on this index → re-check → notice; other errors still toast.
- `EntityV4` — button uses the shared lookup (any visibility), re-checks after publishing, and opens the update composer on `?compose=update`.

## Tests
- ownReview.test.ts (9), ReviewFormExistingReview.test.tsx (7). Full suite 61 files / 878 tests pass; tsgo clean; build OK.

## Signed-in checks for the user (not automatable here)
1. Home → Create → Review → pick something you already reviewed → "You've already reviewed this" → Add an update opens the update pop-up on its page.
2. Same from Profile → Reviews → add new.
3. Entity page of something you reviewed as private or Circle-only → button says Update / Add Timeline Update, not Write Review.
4. A subject you haven't reviewed → form works as before.
