# Phase 5 — Review & Timeline-Update video views (final plan)

I agree with both reviews and have folded in every correction. I also added a few safeguards of my own, listed at the end.

## What the metric means
- A **qualified view** is recorded when one viewer watches at least 2.5 seconds of one Review or Timeline-Update video, counted once per viewer for that video, with no time limit (deduplication lasts forever).
- The 2.5 seconds are **added up within one player session**. Time only counts while the video is playing, at least 50% on screen and in a visible tab. Time spent paused, seeking, buffering or in the background is not counted. Pausing and resuming keeps the time already counted.
- The feed card and the full-screen viewer are separate sessions, so short watches in each are not combined. Once either one records a view, the other cannot record a second one.
- **Authors watching their own videos are not counted.** The server decides who the author is. Post tracking stays exactly as it is today, and this difference is documented.
- There is **no backfill**: counting starts at rollout.
- **Average watch time is removed.** We don't store how long people watch, so we can't calculate it.

## Attribution (fixed)
- Root Review: source `review`, id = the review's id
- Timeline Update: source `review_update`, id = the update's id. An update's views are never credited to the root Review.

## Steps

**Step 1 — Database**
- Allow `review_update` as a source in `media_views`. Keep the existing rule that blocks direct access.
- Add an admin-only summary function. It runs with fixed permissions and checks internally that the caller is an admin, using the existing `has_role` check. It returns totals only, never viewer identities:
  - qualified views
  - registered viewers
  - anonymous sessions (labelled as sessions, not people)
  - results can be filtered by source and optionally by one item
- Add a test that rolls itself back and checks:
  - valid inserts work
  - duplicate views are rejected
  - non-admins are refused by the summary function
  - anonymous and signed-in users still can't insert directly

**Step 2 — Tracking server function (`track-media-view`)**
- Accept `review_update`. Leave the `post` and `entity` paths unchanged.
- For `review` and `review_update`, the server:
  1. Loads the item. It rejects anything deleted or ineligible. For updates, it also loads the parent review.
  2. Checks whether this viewer may see the item, using the same access rules the app already uses (including the parent review for updates). Nothing about public/Circle/private visibility is redesigned.
  3. Skips the author (the review or update owner).
  4. Matches the submitted media to the saved media list and requires a **ready video**. Photos, processing videos and failed videos are rejected.
  5. Saves the **canonical identity taken from the saved record**: the Mux playback ID, or the storage path relative to the bucket. It never saves the URL the browser sent.
- Responses for rejected views stay silent and generic (status 200 with a reason code), as the function does today.

**Step 3 — App wiring**
- The review media block passes `source={kind}` (`review` or `review_update`) through to the shared video player.
- Remove the line that turns tracking off for reviews (`enabled: source !== 'review'`).
- The tracker also stops counting during `waiting`/`seeking` and resumes on `playing`. It keeps adding to the same session's total and does not reset on pause.
- Audit the full-screen viewer: confirm that it sends the same source, id and media identity as the feed card, or document clearly that it doesn't track. Playback and handoff behaviour are not changed.
- Analytics only appear in the existing admin area, if there is a suitable place for them. No new dashboard and no public counters.

**Step 4 — Tests and docs**
- Tracker tests:
  - time adds up across pause and resume
  - buffering, seeking and hidden tabs don't count
  - less than 50% visible doesn't count
  - `review_update` is used as the source
  - `enabled={false}` still turns tracking off
- Server function tests:
  - author excluded
  - viewer without access rejected
  - photo or processing media rejected
  - canonical identity saved
- Run the full test suite, the TypeScript check and the production build. Report the actual results.
- Write `docs/verification/review-video-phase-5.md` and update the roadmap. Then stop for focused QA.

## My additions
- Use one shared helper to resolve canonical media identity, so the matching rule can't drift between paths.
- Keep the existing per-IP rate limit, and also cap repeated rejections per anonymous session.
- QA happens with review videos switched on only in a test environment. The real feature flag stays OFF and is not changed.

## Out of scope
- Watch-duration analytics
- Combining time across players
- Creator self-view analytics
- Any change to Post analytics
- Any feature-flag change
- Any change to Phase 4 playback
- Deleting Mux assets
- Backfill
