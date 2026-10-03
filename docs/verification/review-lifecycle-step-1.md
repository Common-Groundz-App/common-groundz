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

## Step 1 follow-up fixes (2026-10-03)

1. **Readable addresses.** "Add an update" goes to the stored slug, or to the id for offerings. EntityV4 turns `/entity/<uuid>` into the canonical `/entity/<slug>` or `/entity/<parent>/<child>`. It uses `replace`, keeps search and hash, and only fires when the param is a UUID and the path differs, so it can't loop.
2. **Outside results in the review form.** `createIfMissing` is on, and review subjects use strict type parsing, so unknown types are refused. The shared `findOrCreateExternalEntity` (composer and review form) relies on the existing unique `entities_api_source_ref_idx` and re-reads the winner after a lost insert race. Next and Publish are blocked while the subject is being added.
3. **Live stats.** `get_entity_live_stats(uuid)` is SECURITY INVOKER, STABLE, with `search_path=public`, and returns aggregates only.
   - It uses the same rules as `entity_stats_v2`. There are still two copies of the SQL; rebasing the materialised view is a later step.
   - Parity: 0 mismatches across 333 entities with no review change in the last 75 minutes.
   - Madagascar live: 1 review, 4.0. Isha: live and the hourly summary agree (6 reviews, 4.5), using `COALESCE(latest_rating, rating)`.
   - A signed-out RPC call returns `[{review_count, recommendation_count, average_rating}]` only.
   - Refresh: every review write path calls `notifyReviewsChanged()` (create, edit, status, delete, timeline add, timeline undo), in both `services/review/*` and the legacy `reviewService.ts`. CacheProvider then invalidates `entity-detail`.
4. **Unverified.** Concurrent entity creation, which needs an isolated database. Signed-in runtime flows can't be signed in automatically on this project.
