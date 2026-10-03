# Fix three issues found while testing Step 1

These are fixes for problems found while testing Step 1. Step 1 isn't done until they pass. Step 2, Step 3 and the paused phases have not started.

## 1. "Add an update" opens a link with a long ID instead of the readable name
**Why:** the review form sends you to `/entity/<id>`, not the entity's stored readable address (for example `/entity/isha-foundation-chikkaballapura` or `/entity/skin1004/madagascar-centella-quick-calming-pad`).

**Fix:**
- The form already has the saved subject, with its stored readable name and its parent's. The link is built with the app's shared link helper, so it matches every other entity link. Readable names are never made up from the display name.
- If someone opens an old `/entity/<id>` link, the page switches to the readable address once it knows which entity it is.
  - Anything after the address is kept: `?compose=update` and any `#section`.
  - The address is only changed when it's actually different, so it can't loop.
  - Back doesn't land on the old ID address.
- Other ID-based links in the app are checked one by one. A link only moves to the shared helper if it really takes you to an entity page and already has the readable name. Places that only have an ID keep it and rely on the switch above.

## 2. "We can't add this one yet" when you pick an outside search result
**Why:** this is not a bug. During the earlier subject work, the review form's search was deliberately limited to things already on Groundz. Creating items in the background still works in the post composer. It was just switched off here.

**Fix:** turn creation back on in the review form, using the same tested path as the composer. The steps, in order:
1. Read the result's type strictly. If the type isn't recognised, show a clear message. It is never saved as "others".
2. Check whether the item is already on Groundz.
3. Create it only if it's missing.
4. Wait until it's saved and has a real ID.
5. Run the Step 1 "already reviewed?" check on that saved item.
6. Let you continue.

While steps 2–5 run, the selected row says "Adding to Groundz…" and Next and Publish stay disabled. If it fails, nothing stays selected and you can try again.

**Duplicate protection (checked):** the database already allows only one item per outside source and outside ID. There are 0 duplicates today. What's missing is the recovery when two saves hit at the same moment (two tabs, or two people). Today the second one fails with an error. Both the composer and the review form will share one "find or create" step: if the database says the item already exists, it fetches the saved one and carries on, instead of showing an error. Any other error is still shown.

## 3. The rating on the entity page doesn't change after a review
**Why (confirmed):** your review is saved correctly: public, published, rating 4. The page reads its numbers from a summary that is rebuilt once an hour, and that summary still shows 0 reviews.

**Fix:** the entity page's Overall Rating, review count, Recommendations and Average tiles will all read one fresh count, taken straight from the reviews. That count follows exactly the same rules as the hourly summary (checked):
- Only public, published reviews with a linked subject count. Your own private or Circle-only review never changes the public numbers.
- One contribution per person per subject: their newest review.
- The rating used is the **current** one. If a timeline update changed your rating, the latest update's rating counts, not the original one.
- Recommending is counted from the review's current recommending state.
- Deleted subjects show nothing, and a subject with no reviews shows zero.

For now there will be two copies of these rules: the new fresh count and the hourly summary. They are kept in step by a comparison check, which is run now and written up. Making the hourly summary read from the same shared rules is a later, separate step. The hourly summary itself stays as it is for lists and trending.

**Privacy:** the fresh count only ever returns totals: how many reviews, how many recommending, and the average. It never returns individual reviews or who wrote them, and it runs with the visitor's own access, not elevated access. A check confirms that a signed-out visitor gets only those totals, and that private or Circle-only reviews don't change them.

The page re-reads the count right after any of these:
- publishing, editing or deleting a review
- changing a review's visibility or subject
- adding a timeline update
- undoing a timeline update

## Checks
- Focused tests:
  - The update link uses readable addresses, including brand/product ones. Old ID links switch over, keeping `?...` and `#...`, with no loop.
  - Outside results: pending state, a failure that clears the selection, a retry with no duplicate, and an unknown type refused.
  - The fresh count is re-read after every action in the list above.
- Then the full test suite, a type check and the build log.
- Read-only checks:
  - Madagascar Centella shows 1 review at 4.0 in the fresh count.
  - The fresh count and the hourly summary agree for every subject whose data hasn't changed since the last rebuild.
  - Isha Foundation's average uses the latest timeline rating.
- Signed-in checks for you:
  - Add an update lands on the readable address and the update form opens. Refreshing it works, and Back behaves normally.
  - Pick an outside movie in Create → Review.
  - Publish a public review: the numbers change at once.
  - A private or Circle-only review doesn't change them.
  - Add a timeline rating, then undo it: the average moves, then moves back.
  - Delete a review: the count drops.

## Technical details
- URL: `getEntityUrlWithParent` (stored `slug`/`parent_slug`) in `handleAddUpdateToExisting`. In EntityV4, if `isUUID(param)` and the canonical path is not equal to `location.pathname`, then `navigate(canonical + location.search + location.hash, { replace: true })`. Audit `/entity/${…id}` with `rg`, and convert only call sites that have slug data.
- External: SubjectSelectStep `externalResultPolicy="createIfMissing"` with `allowInlineCreate={false}`. Keep strict `parseEntityTypeAtBoundary` for review subjects. Expose an `isResolving` callback from UnifiedEntitySelector so ReviewForm can block progression. `onSubjectChange` only receives the persisted entity.
  - The existing `entities_api_source_ref_idx` (unique `(api_source, api_ref)` where both are not null) is the atomic guard. No new index is needed.
  - Add a shared `findOrCreateExternalEntity` used by both the composer and the review form: find, then create, and on a 23505 naming `entities_api_source_ref_idx`, re-run the find and return the winner.
  - If the existing row is soft-deleted, show a clear message rather than a silent failure.
- Stats: plain SQL function `get_entity_live_stats(p_entity_id uuid)`:
  - `SECURITY INVOKER`, `STABLE`, `SET search_path = public`.
  - Returns only `review_count`, `recommendation_count` and `average_rating`. It is the same CTE and aggregation as `entity_stats_v2`: `DISTINCT ON (user_id, entity_id)` newest, `COALESCE(latest_rating, rating)`, `is_recommended`, `visibility='public'`, `status='published'`, `is_deleted=false`.
  - No new view. `REVOKE ALL FROM PUBLIC`, then `GRANT EXECUTE` to anon, authenticated and service_role.
  - Parity query against `entity_stats_v2` for all entities with no review change since the last refresh, recorded in the verification doc.
  - A signed-out RPC call is checked to return aggregates only.
  - One React Query key covers the header and tiles. It is invalidated by review create/update/delete, visibility/entity changes, timeline insert and timeline undo.
- roadmap.md gets these three fixes as Step 1 follow-ups once building starts.
