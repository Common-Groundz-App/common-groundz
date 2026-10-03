# Remove the address-bar jump when adding an update

## Recommendation
Fix the jump rather than leave it. The review form currently sends some subjects to `/entity/<ID>?compose=update`; only after the entity page loads does it replace that with the saved readable address. The screenshot shows this exact intermediate state. Also, the destination removes `?compose=update` after opening the timeline, causing another address-bar change. These are navigation refinements, not problems with the review or its data.

## Options considered
- **Keep the current behavior:** safe and functional, but the temporary ID remains noticeable on slower connections.
- **Resolve the saved address during the existing-review check (recommended):** the button can navigate immediately to the final readable address, passing a one-time “open update” intent without showing an intermediate URL. If the address was unavailable, resolve it on click with a pending/retry state instead.
- **Hide the old page until its redirect finishes:** conceals some screen flicker but cannot stop the ID appearing in the address bar, so it does not solve this concern.

## Scope of the change
1. When the selected subject is checked for an existing review, resolve its **stored** slug and, for an offering, its stored parent slug too. Return the existing review ID and canonical destination together; use the existing entity-link helper and never invent a slug from a display name. If routing information fails to resolve, keep the review check authoritative but use a click-time pending/retry lookup; never navigate to an ID as a fallback. Keep any in-flight lookup tied to the currently selected subject so an older result cannot navigate to the wrong page.
2. “Add an update” navigates once to that readable address with a one-time state marker containing the review ID, rather than `?compose=update`. The entity page waits for its signed-in owner-review lookup, confirms the ID belongs to the current signed-in user and subject, opens the timeline once, then removes **only** that marker from the current history entry using a same-URL replace; preserve any unrelated navigation state. Closing the timeline or returning with Back/Forward must not reopen it. Do not open a different review if validation fails.
3. Preserve support for old or manually shared `?compose=update` links, including the existing ID-to-readable redirect; those compatibility paths may still replace the URL, but the normal button will not.
4. Keep the one-review rule, other entity links and existing modal behavior unchanged. Do not redesign `EntityAdapter` or start lifecycle Steps 2–3 or paused phases.

## Verification
- From Home → Create → Review, choose an existing review and click “Add an update”: the first address is the stored readable one, the timeline opens, and no ID or `?compose=update` appears, including for a parent/child entity. The button needs no extra loading pause when the existing-review check already resolved its address.
- Check missing-address pending/failure/retry behavior, a changed selection while a lookup is pending, and refresh on the readable address. After the timeline opens, close it, navigate elsewhere and use Back/Forward: it must not reopen; unrelated navigation state must remain intact. A mismatched review ID must not open another review.
- Confirm an old `/entity/<ID>?compose=update` link still reaches the readable page and opens the update; run focused tests and check the preview.

## Technical details
The review form currently falls back to the ID for offerings in `handleAddUpdateToExisting`. The selector’s `EntityAdapter` does not carry slugs. Extend the shared `findOwnReviewForEntity` found result with a canonical destination resolved from persisted `slug`/`parent_id` and the parent’s stored `slug`, while keeping `found`/`none`/`error` ownership semantics intact. Resolve this during the existing check, not through a broad `EntityAdapter` refactor. Pass `{ openReviewUpdate: { reviewId } }` in navigation state. In `EntityV4`, compare it against the session-derived `userReview` and current entity before opening, then replace the same URL with just that state key removed; retain the query-parameter compatibility path. Ignore stale asynchronous results if the dialog closes or the subject changes.
