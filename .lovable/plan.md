# Phase 1: what to do now that the SQL Editor runs one query at a time

## Agreed record for Race 1A
- Functional rule: **passed**. A timeline video can't be saved once the review is private (`review_video_public_only`).
- Real overlap / lock proof: **unverified**. Tab B only started after Tab A finished.

## Options that meet your conditions
No dblink, no permanent helpers or permissions, no credentials shared with me.

| Option | Safety | Effort | Proves overlap? |
|---|---|---|---|
| **A. Two separate browser sessions of the SQL Editor** (one normal window and one private/incognito window, or two different browsers), both signed into your Supabase dashboard yourself | Same as before. Nothing new is installed or granted. You sign in yourself | Low: one quick try | Only if the dashboard lets two sessions run at once. The watch query will show it either way |
| **B. Two terminal windows on your own computer using `psql`**, connected with your own database password, which never leaves your machine | Safe, but it means installing a database tool and handling your database password locally | Medium to high | Yes, reliably |
| **C. Close Phase 1 with the three races marked "overlap unverified"** | Safest; nothing more runs | None | No |

### My recommendation
1. **Try Option A once, with Race 1A only.**
   - If the watch query shows two different `pid`s, with B waiting on A's lock, we run the remaining races the same way.
   - If B still won't start until A finishes, stop there.
2. **If A doesn't work, take Option C.** I don't recommend Option B. Handling the database password on your computer adds risk, just to test locks we already designed carefully. And changing how production works just to test it would be wrong.

Why closing with "unverified" is reasonable:
- The locking rules themselves are in place.
- The single-connection tests (39/39) prove every rule's outcome.
- Race 1A's outcome has also been confirmed live.
- What stays unproven is only the timing guarantee under true simultaneous saves.

## Clean up first, whatever you choose
After Race 1A the test review is still in the database and set to **private**. Run the exact-ID **Cleanup** script and then the **Cleanup check** from the previous package (unchanged; every value must be 0). For Option A, run Step 1 setup again before retrying Race 1A.

## If we close Phase 1 (Option C, or A fails)
I'll update the Phase 1 verification note and roadmap to say:
- **Race 1** (private vs timeline video): rule passed in both directions on one connection; 1A also confirmed live. Overlap unverified.
- **Race 2** (Mux ready vs removing the video): outcome passed on one connection. Overlap unverified.
- **Race 3** (Mux ready vs reordering): outcome passed on one connection. Overlap unverified.
- Why it's unverified: the Supabase SQL Editor runs one query at a time; dblink was declined; no other two-connection method was available without handling credentials.
- Risk note: the database is built to make these cases wait for each other (row locks plus a per-review lock). The tests just couldn't watch it happen.
- **Follow-up:** re-run the three races if a two-connection test setup becomes available, for example a separate test database.

Then Phase 1 is closed. Video uploads stay off and Phase 2 stays on hold until you approve it separately.

## Not touched
Production rules, permissions, posts, photo cleanup, legacy forms, review screens.
