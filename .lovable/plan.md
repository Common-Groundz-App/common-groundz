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
- Where this applies: review videos are only shown on review cards and in the review timeline, on entity pages and profiles. "Review"-type posts on Home are Posts, so they keep Post tracking and are not changed.
- The review media block passes `source={kind}` (`review` or `review_update`) through to the shared video player.
- Remove the line that turns tracking off for reviews (`enabled: source !== 'review'`).
- New rules for counting time (excluding buffering and seeking, and keeping the total across pauses) apply **only to `review` and `review_update`**. Post tracking keeps its exact current behaviour. If any of these rules already exist in the shared tracker, that is confirmed in the docs rather than changed.
- If the content or media being watched changes, the timer is reset, so time spent on one video can never count toward another.
- **Tracking in the full-screen viewer is required.** The review card and the full-screen viewer each track on their own, and both send the same source, id and media identity. Whichever reaches 2.5 seconds first records the view, and the database's uniqueness rule stops the other from counting it again. If the viewer doesn't track yet, it is connected to the existing tracker without changing playback or handoff.
- Analytics only appear in the existing admin area, if there is a suitable place for them. No new dashboard and no public counters.

**Step 4 — Tests and docs**
- Tracker tests:
  - time adds up across pause and resume
  - buffering, seeking and hidden tabs don't count
  - less than 50% visible doesn't count
  - the timer resets when the media changes
  - `review_update` is used as the source
  - `enabled={false}` still turns tracking off
  - Post behaviour is unchanged
- Server function and SQL tests:
  - author excluded
  - viewer without access rejected
  - deleted content rejected
  - photos, processing videos and failed videos rejected
  - canonical identity saved
  - anonymous duplicates collapse to one view
  - duplicates sent at the same moment collapse to one view
  - a view in the card and in the viewer counts once
  - composer previews never record a view
- Run all checks: SQL, Edge Function, the full test suite, the TypeScript check and the production build. Report each result as passed, failed or blocked.
- Write `docs/verification/review-video-phase-5.md` and update the roadmap. Then stop for focused QA.

## Metric definitions
- **Qualified views:** the number of distinct viewer and video pairs, after duplicates are removed.
- **Registered viewers and anonymous sessions:** each person or session is counted once across the whole filtered set, not once per video and then added up.
- **Deduplication:** applies for good to the saved media identity. This is not a promise that a playback ID is a permanent identity for the video file.
- **Known limitation:** an author can only be excluded while signed in. If they watch while signed out, the view is counted, and the docs say so.

## My additions
- Use one shared helper to resolve canonical media identity, so the matching rule can't drift between paths.
- Keep the existing per-IP rate limit only. Limiting repeated rejections is not part of this phase.
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
