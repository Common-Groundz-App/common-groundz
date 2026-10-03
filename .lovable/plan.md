# Remove the address-bar jump when adding an update

## Recommendation
Fix the jump rather than leave it. The review form currently sends some subjects to `/entity/<ID>?compose=update`; only after the entity page loads does it replace that with the saved readable address. The screenshot shows this exact intermediate state. Also, the destination removes `?compose=update` after opening the timeline, causing another address-bar change. These are navigation refinements, not problems with the review or its data.

## Options considered
- **Keep the current behavior:** safe and functional, but the temporary ID remains noticeable on slower connections.
- **Look up the saved address before leaving the review form (recommended):** navigate once to the final readable address, and pass the “open update” intent with the navigation rather than briefly showing it in the URL. This keeps the address bar steady through the normal in-app flow.
- **Hide the old page until its redirect finishes:** conceals some screen flicker but cannot stop the ID appearing in the address bar, so it does not solve this concern.

## Scope of the change
1. On “Add an update,” resolve the selected subject’s stored slug and, for an offering, its stored parent slug **before** navigation. Use the existing entity-link helper to construct the correct top-level or parent/child address. Do not invent a slug from its name. Keep the review dialog in place with a short pending state while resolving; on failure, offer retry instead of briefly navigating to an ID address.
2. For this in-app action, carry the instruction to open the timeline in navigation state, not `?compose=update`, so the readable address is the first and final visible URL. The entity page should consume that state once, after finding the viewer’s existing review. Preserve support for old or manually shared `?compose=update` links, including the existing ID-to-readable redirect; those compatibility paths may still replace the URL, but the normal button will not.
3. Keep the existing review lookup, one-review rule, modal behavior, other entity links, and Back behavior unchanged. Do not start lifecycle Steps 2–3 or paused phases.

## Verification
- From Home → Create → Review, choose an existing review and click “Add an update”: the first address is the stored readable one, the timeline opens, and no ID or `?compose=update` appears, including for a parent/child entity.
- Check the pending/failure/retry state, back navigation, and refresh on the readable address.
- Confirm an old `/entity/<ID>?compose=update` link still reaches the readable page and opens the update; run focused tests and check the preview.

## Technical details
The review form currently falls back to the ID for offerings in `handleAddUpdateToExisting`. The selector’s `EntityAdapter` does not carry slugs, so the click handler cannot safely construct every canonical address from its current state. Resolve persisted `slug` and `parent_id`, then the parent’s `slug`; build via the shared URL helper, and pass an `openUpdate` navigation-state marker. On `EntityV4`, consume that marker once when `userReview` is available; retain the query-parameter compatibility path. Ignore stale asynchronous results if the dialog closes or the subject changes.
