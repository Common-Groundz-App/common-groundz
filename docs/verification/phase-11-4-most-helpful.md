# Phase 11.4 — Most Helpful sorting

## Scope delivered
- Shared sort (`src/utils/reviewDataUtils.ts`): `mostHelpful` = Helpful count DESC → created_at DESC → id DESC; Highest/Lowest Rated and Most Recent use the same final tie-breakers.
- Entity V4 (`ReviewsSection.tsx`): new "Most Helpful" option. Default "Most Recent" layout unchanged except the hard 3-card cut-off became "Show more reviews (N remaining)".
  Under Most Helpful: "From Your Circle" group first, "Community Reviews" second; Standard and Timeline reviews ranked together inside each group; 5 shown per group, +5 per Show More; expansion resets on sort/filter/search change. Owner-private review stays pinned and outside ranking.
- Stable positions (`useStableReviewOrder`): while Most Helpful is active, Helpful votes update counts but not positions; re-ranked on sort/filter/search change or fresh navigation. Reviews that disappear (Private, deleted, ineligible) are removed immediately; new ones append.
- Profile Reviews: "Most Liked" → "Most Helpful". Public reviews ranked; owner Private reviews follow, newest first, never in the ranking.
- Retrieval (`src/services/review/pagedFetch.ts`): `fetchEntityReviews` and profile `fetchUserReviews` page with `.order(created_at desc, id desc).range()` in 500-row pages with `count: 'exact'`. The set is accepted only if every page reports the same count and the deduplicated total equals it; otherwise `ReviewDatasetIncompleteError`. Page errors throw (previously returned an empty list).
- Helpful counts (`fetchReviewHelpfulState`): `get_review_likes_batch` / `get_user_review_likes` in 200-id chunks; a failed chunk rejects — no synthetic zeros. Entity enrichment now uses this path.

## Known limits
- Offset paging plus count checks detects, but cannot prevent, concurrent insert/delete during retrieval; detection raises an error (react-query retries) rather than showing a partial list. An insert and delete of equal size between pages could in theory keep the count equal while shifting rows; the deduplicated-total check catches the duplicate case, not a pure swap. Acceptable at current scale; a server-side ranking RPC/keyset paging is the scaling step.
- No database, RPC or RLS changes.

## Verification
- Results: full Vitest 1,391 passed / 3 skipped (124 files); TypeScript check clean; production build OK; guest browser check on Nandi Hills: Most Helpful ranks the 1-vote review above the 0-vote one.
- New tests: `src/utils/__tests__/phase11_4MostHelpful.test.ts`, `src/services/review/__tests__/phase11_4HelpfulBatches.test.ts` (tie-breaking, Timeline parity, default order, stable positions, immediate removal, multi-page retrieval, page failure, count drift/gap, missing count, chunking, failed count batch).
- Pending: signed-in browser QA of voting with stable positions (session limitation as in 11.3).

## Next: Phase 11.4A (not started)
Author-only historical Helpful count on Private reviews via a new owner-gated read; `get_review_likes_batch` stays Public-only.
