# Post-Group-6 cleanup: Step 2 (the old picture helper), revised

## Check result: 6E and Step 1
- 6E is complete, with no leftovers.
- Step 1 is complete: the unused product card is deleted and the unused line is removed. 846 checks pass.

## What the reviews asked me to check: the second attempt
- **What the first request is:** for book covers, film posters and some shop sites, the app first loads the picture through our own image relay. Every other picture loads directly.
- **Why the second attempt exists:** if our relay fails (it is down, slow, or refuses the link), the app then tries the original link directly. A picture on a page usually loads fine without the relay, so **the second attempt can rescue a real picture.**
- **Who can reach it:** only screens that show book, film or shop pictures. That means the admin search rows, the image candidates and the auto-fill preview. The profile cover, location photos and review uploads normally never go through the relay.
- **Decision:** ChatGPT is right. **The second attempt stays**, limited to exactly one try, and only when the first try went through the relay. Removing it could turn real pictures into empty boxes. This differs from the entity rule ("one request") on purpose, because none of these screens show an entity's own picture.

## What changes (stock photos only)
- The built-in random photo, the type-to-photo lookup and the `entityType` setting are removed from the helper.
- There is no link and no fallback from the screen → nothing is drawn inside the existing box.
- Codex is right that a silent blank box is unclear. So a picture that **really failed** shows a small local **"Image failed to load"** panel (the same one admin already uses), filling the box that is already there.

## Each screen after Step 2
| Screen | Picture fails today | After |
|---|---|---|
| Profile → cover banner | Your default cover | **Same.** Default cover, tried once. If that also fails, the plain banner background, with no loop |
| Location search (post composer) | Its own food photo | **Same.** Kept and recorded as a deliberate location exception, not counted as "no stock photos left" |
| Review → add photo → preview | Stock photo | "Image failed to load" in the same 192px box |
| Admin → New Entity → "already on Groundz" rows | Stock photo | "Image failed to load" in the 56×56 box. No link → empty box, as today |
| Admin → New Entity → result rows | Stock photo | "Image failed to load" in the 56×56 box. No link → initials, as today |
| Admin → image candidates | Product stock photo, then marked broken | Marked broken exactly once, as today, with its existing "Image unavailable" overlay and no stock photo |
| Admin → auto-fill → image grid and primary image | Type stock photo | "Image failed to load" in the same spot, capped at its current height |

Box sizes, corners, crop and layout are unchanged. Working pictures look exactly as they do today.

## Rules the reviews added (all accepted)
- **Fallback same as the original:** if the screen's fallback is the same link as the picture, including after normalising http to https or passing through the relay, it is not requested again. The picture goes straight to the failed state.
- **When the "failed" signal fires:**
  - The picture fails with no fallback → it fires once.
  - The picture fails and a fallback exists → it fires once, when the picture fails, which keeps the profile cover's logging as it is today.
  - The fallback also fails → nothing fires again, and there is no loop.
  - The relay-to-direct retry does not fire it. Only a final failure does.
  - Image candidates must mark a picture broken exactly once.
- **Resets:**
  - A new picture link or a new fallback clears any failed state.
  - A late error from an old link is ignored after the link has changed.
  - A failed fallback followed by a new, good link shows the new picture.
- **Kept on purpose:** the Unsplash rule for loading pictures across sites stays, because real Unsplash photos still exist.

**Stop** after Step 2. After that come Step 3 (stock-photo lists), Step 4 (optional database tidy-up) and Step 5 (central rule and the final inventory), each needing its own approval.

## Technical details
- `ImageWithFallback.tsx`: remove `entityType`, the `getEntityTypeFallbackImage` import and the default Unsplash constant. Keep the `proxyAttempted` branch, but set it only when `processUrl(src) !== ensureHttps(src)`, and do not call `onError` on that step. Add an optional `failedContent?: ReactNode`, rendered at the terminal failure when there is no usable fallback. Empty `src` with no fallback → render `null`. Equivalence is checked with `processUrl(fallback) === processUrl(src)` or `ensureHttps` equality. State is keyed on `src|fallbackSrc`, so an error from an older key is ignored. The first-failure callback is guarded by a ref that resets on key change.
- Extract the failed panel from `admin/EvidenceImage.tsx` into a shared `ImageFailedState` (local icon and text, no request). EvidenceImage uses it, with no visual change.
- Callers:
  - ImageUploader, both SearchEntryPanel rows, and both AutoFillPreviewModal sites pass `failedContent={<ImageFailedState/>}`. AutoFill's primary image gets an `h-32` panel so its height stays within the current `max-h-32`.
  - Drop `entityType=` from ImageCandidateGrid and AutoFill. ImageCandidateGrid's `markBroken` is unchanged.
  - ProfileCoverImage and LocationSearchInput are unchanged.
- Test file `src/components/common/imageWithFallbackStep2.test.tsx`, registered in vitest.config.ts. It covers:
  - Empty src → nothing.
  - A direct failure with no fallback → the failed panel, no second request, `onError` once.
  - A relay failure → one direct retry and no `onError`, then a direct failure → the failed panel and `onError` once.
  - A fallback that fails → no loop, and no second callback.
  - A fallback equal to the source (raw, http/https, relay) → no second request.
  - Resets on a change of source or fallback.
  - A stale error is ignored.
  - A real image keeps its src and classes.
  - No Unsplash or `/placeholder.svg` appears unless the caller supplies it.
  - ImageCandidateGrid marks broken exactly once.
- Checks: the full suite, tsgo, focused lint and the build log. Notes go in `docs/verification/post6-step2-image-helper.md`, the inventory (the location photo exception is recorded) and the roadmap.
