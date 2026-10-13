# Phase 4 — Final condensed verification session

One sitting, about 15 minutes. You do 7 short browser steps as Hana, and I do the database checks myself after you report. Review videos stay ON (you turned them on at 17:22 IST) until step 7.

Everything not listed here is covered by the Phase 1 database tests (39/39), the Phase 2/3/4 automated tests (1066 passed) and Blocks 1–2. Those items are marked "covered by automated tests", not re-tested by hand.

## Your checklist (do all in one go, then report)

**1. Broken video** (CHANEL review → Add update)
Pick `broken-picture-5s.mp4`, type any text, and wait up to 2 minutes.
- If the tile shows "Upload failed": press Save. It should be blocked. Then remove the video and close without saving.
- If it still shows Processing: press Save. Wait 1–2 minutes and check the update. It should show no playable video to you (owner message only), and nothing broken should appear.
- Report which one happened.

**2. No-length video** (same screen, new Add update)
Pick `no-length-70s.mp4`. You should see "Length will be checked after upload". Save once it allows you. After 1–2 minutes the video should never play, because the server marks it as too long.

**3. Timeline Update's own video** (same CHANEL review → Add update)
Add `ok-8s.mp4` only, then save. Open the review's timeline and scroll so that only the update's video is on screen. Expected: that video plays on its own.

**4. Page player coordination** (CHANEL page)
- Scroll the reviews. Only one video plays at a time.
- Tap a video to open full screen. The page video pauses, and the same video continues from the same moment.
- Close it. The video resumes in the card with nothing playing behind.
- Open the timeline pop-up. No other video should play behind it.

**5. One-hour lock** (natural, no waiting needed)
The CHANEL review was created at 16:27 IST, so its edit window has already closed. Open the review's menu. Expected: Edit is no longer offered (or is refused), and Delete and Add update are still available. Don't delete it.

**6. Privacy** (one check, no extra account)
In a private/incognito window, signed out, open the Pixi Antioxidant Tonic page. Expected: Hana's "Only me" review is not shown.

**7. Post video regression, then switch off**
- On the home feed, scroll to any post with a video. It plays muted on its own, opens full screen and comes back.
- Then go to Admin → Feature flags → turn **Review videos OFF** and tell me the time.

## What I do after your report (no actions from you)

- Read-only database checks for steps 1–3: the upload status, failed/too-long state, no playback shown, links, and that the cover is never a failed poster.
- Confirm the edit lock for step 5 from the stored timestamps.
- Confirm the Review videos setting is OFF.
- Add every new upload ID to the retained test assets. Nothing in Mux gets deleted.
- Fill in the Phase 4 checklist and the roadmap with pass, fail or untested for each item.
- Mark Phase 4 complete if all items pass. Any failed or untested item stays listed. Then comes the short final acceptance smoke test.

## Accepted as untested (recorded, not chased)

- The exact "Wait for your video to finish uploading" message.
- Saving while a video is Processing. Mux finishes in 3–6 seconds.
- A real Mux event arriving after the hour has passed.
- True simultaneous-connection overlap from Phase 1. This needs a separate rollout decision.
- Circle reviews are only visible to the author today. This is a separate product decision.
