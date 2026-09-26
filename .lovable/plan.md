# Remaining monitoring fixes (4 confirmed issues)

Three findings are already fixed (admin image picker tile, questionnaire answers on subject change, "Service" option removed from the quick-create dialog). The four below are confirmed but touch the database or shared picture handling, so they need approval.

## 1. Ratings and counts lag up to an hour
Ratings and review counts come from a summary that refreshes hourly.
- Add a lightweight database function that refreshes that summary, and call it right after a review is published, edited or deleted (debounced, runs in the background).
- Keep the hourly refresh as a safety net.

## 4. Some real photos show a grey icon
Small entity thumbnails (search rows, child rows, sidebar parent row, selector rows, product search) stopped routing tricky image hosts (Amazon, Google Books, OpenLibrary, movie sites) through the app's image proxy.
- Make the shared entity picture helper apply the same https upgrade and proxy routing the old component used, with one direct retry if the proxy fails, then the type icon.
- No change to sizes, shapes or layout.

## 5. "Hidden Gems" and "New This Week" can be empty
Both pick a few items first, then drop the unreviewed ones.
- Pick candidates only from items that already have reviews (join the review summary), then apply the existing filters and limits.

## 7. Creating an entity fails if its name matches an old web address
- In the slug function, when a supplied address is taken only by an old (renamed) entity's history, add a number suffix instead of failing. Real clashes with a live entity keep today's behaviour.
- Apply the same check in the non-admin create path.

## Technical details
- #1: `refresh_entity_stats_v2()` SECURITY DEFINER, `REFRESH MATERIALIZED VIEW CONCURRENTLY`, invoked from review write services; invalidate entity-detail queries after it returns.
- #4: `useEntityImageFallback` returns `ensureHttps` + `getProxyUrlForImage` URL, retries raw URL once on error before `markImageFailed`.
- #5: `enhancedExploreService.getHiddenGems` and `discoveryService.getNewThisWeek` select from `entity_stats_v2` inner-joined (review_count > 0) before limit.
- #7: migration updating `generate_entity_slug_v2` supplied-slug branch + `create_brand_and_entity_atomic` loop to use `entity_slug_is_taken`.
