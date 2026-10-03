# Fix three issues found while testing Step 1

## 1. "Add an update" opens a link with a long ID instead of the readable name
**Why:** the review form sends you to `/entity/<id>`, not the entity's readable name (for example `/entity/isha-foundation-chikkaballapura`). The page still loads, but the address bar shows the ID.

**Fix:**
- The form already has the selected subject, including its readable name and its parent if it has one. Build the link with the app's existing link helper, so it matches every other entity link: `/entity/<name>` or `/entity/<brand>/<name>`.
- When the entity page is opened with an ID, it quietly swaps the address for the readable one. Your place in the page and the `?compose=update` that opens the update form are kept. This covers old links and any spot that still uses IDs.
- Search the app for other links built from entity IDs and switch them to the shared helper.

## 2. "We can't add this one yet" when you pick an outside search result
**Why:** this is not a bug. During the earlier subject work, the review form's search was deliberately limited to things already on Groundz. Search results from outside sources (movies, books, places) are shown but blocked. Creating them in the background still works in the post composer. It was just switched off here.

**Fix:** turn creation back on for the review form. It will use the same tested path as the composer: first check whether the item is already on Groundz, then create it if not. After that, the duplicate-review check from Step 1 runs on the result as usual. Results whose type can't be read get a clear message instead of being guessed (taxonomy rule).

## 3. The rating on the entity page doesn't change after a review
**Why (confirmed):** the review is saved correctly: public, published, rating 4. But the page reads its numbers from a summary table that is only rebuilt once an hour (at :05 past each hour). That table still shows 0 reviews for this product. So every new review takes up to an hour to show, and refreshing the page doesn't help.

**Fix:** the entity page's Overall Rating, review count and "Total Reviews / Average Rating" tiles will count straight from the reviews themselves, so they're correct as soon as a review is published, updated or deleted. The hourly summary stays as it is for lists and trending, where a short delay is fine. After you publish, the page refreshes these numbers right away.

## Checks
- Focused tests for the update link, outside-result creation in the review form, and the live rating count. Then the full test suite, a type check and the build log.
- Read-only check that the live count for Madagascar Centella shows 1 review at 4.0.
- Signed-in checks for you: Add an update shows the readable address; pick an outside movie in Create → Review; publish a review and see the rating change without waiting.

## Technical details
- ReviewForm `handleAddUpdateToExisting`: use `getEntityUrlWithParent`/`getEntityUrl` from `utils/entityUrlUtils`, plus `?compose=update`. EntityV4: when the route param is a UUID and the loaded entity has a slug, call `navigate(canonical + search, { replace: true })`. Use `rg` to find `/entity/${...id}` templates and replace them.
- SubjectSelectStep: `externalResultPolicy="createIfMissing"`. Keep `allowInlineCreate={false}` and the strict `parseEntityTypeAtBoundary` path for review subjects, so unknown types are refused, not saved as `others`.
- New `get_entity_live_stats(entity_id)` SQL function (stable, security invoker): count, average rating and recommending count over published public reviews, using the same rules as `entity_stats_v2`. EntityV4 stats hook uses it for the header and tiles. Invalidate the query after review publish, update or delete. `entity_stats_v2` and its hourly cron are unchanged.
