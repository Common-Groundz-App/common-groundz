# Phase 2 build: server rules for Post videos (revised)

## My view on the feedback

Both reviews are right, and Codex's main point matters most. I checked what /create sends today: a new post video goes out with `mux_status: 'preparing'`, its upload ID and a poster address. My first plan said a browser save that sets Mux fields would be refused. That could have broken a normal Post on /create. So the rule changes from "refuse" to **"the server overwrites"**: on every save, the server throws away whatever Mux details the browser sent and fills them in from the upload's own record. Reviews already work this way, so posts copy a pattern that has been tested.

This also covers the other points:
- **Edits made with stale details:** if a video finishes while the edit screen is open, the save still keeps the newer server state, and nothing fails.
- **Videos are matched by their upload ID**, never by their position in the list.
- **Other changes to the media are never blocked.** Only the Mux details are server-owned (ChatGPT's point).

**Points I accept:**
- The trigger order gets tested.
- The 60-second flag must be impossible for a browser to set.
- Every path that marks a video ready applies the 60-second rule.
- The two historical posts get their own unrelated-edit test.

**One clarification (Codex point 4):** posts still fall back to normal file storage when Mux uploads are switched off (reviews don't). Those fallback videos are checked for length in the browser only. The server can't measure them, so they're recorded as a known limitation. "Server-checked" will only ever be claimed for Mux videos.

## Old-posts report (done)

161 posts and 38 videos: no post over 4 items, none with more than 1 video, none over 60 s (the longest is 32 s), and every video has a stable identity. **Known historical data, excluded:** posts `d4941fd5-c594-433b-9501-9d339482f55b` (live) and `3e5b7e00-1c4b-49ca-8cc3-9cc1f31b5b6f` (deleted) have no link record. They're left as they are: no repair, no relink.

## What gets built

1. **Max 4 items and 1 video, checked by the server.** A save is refused only when it adds items or videos past the limit. Caption edits, unchanged media and removals always go through.
2. **Mux details owned by the server.** On every browser save, each Mux video's provider, status, playback ID, asset ID, playback/poster address, length, aspect ratio and error are rebuilt from its upload record. Anything else about the item (caption, order) is kept as sent.
3. **The uploader must be the author.** A Mux video whose upload belongs to someone else, or doesn't exist, is refused.
4. **60 s for new videos only.** Uploads get an "eligible" flag at creation. It can never be changed afterwards by anyone, including webhooks and catch-up jobs. An eligible upload over 60 s becomes "too long" with no playback link, on every path: saving the post, the Mux webhook patch, and the existing linking and catch-up requests. Old uploads stay ineligible and keep playing.
5. **Old stored-file videos and the two historical posts aren't touched.** Unchanged items pass through as they are, and an old Mux item without an upload record is grandfathered only when it's carried over unchanged.
6. **No app code changes, and /create stays the same.** The existing linking requests keep working until Phase 3.

## Tests (then stop and report)

SQL tests run as the signed-in author on made-up records and are rolled back. They use the **exact payload /create sends** (preparing status, upload ID, poster address), and they cover:
- an exact /create payload saves fine;
- a forged playback ID or "ready" status gets overwritten from the upload record;
- a stale "preparing" sent after the video is ready keeps ready;
- a 5th item is refused, and so is a 2nd video;
- an unrelated edit and a removal on an over-limit post both go through;
- an eligible upload over 60 s becomes too long, while an old ineligible one stays ready;
- a browser can't set or change the eligibility flag;
- someone else's upload is refused;
- an old stored-file video is untouched;
- a caption edit on a copy of the historical stuck post goes through and doesn't link the video;
- the existing linking call and the webhook patch still work, with the 60 s rule applied;
- the trigger order is checked (after the media and edit-window guards);
- removing a photo next to an unchanged historical video goes through even though its position shifts; the video is matched by identity, not repaired or relinked;
- a forged playback URL or provider on a Mux item is overwritten, so it can't make a video playable;
- the eligibility flag stays unchanged through the webhook patch, linking and catch-up paths.

Then I run the post composer and media app tests, typecheck and build, and report passed, failed and blocked results. Phase 2 closes these rules only: one-save linking and stable IDs stay open for Phases 3 and 4. Historical assets stay untouched and Review videos stay OFF.

## After deploy (not part of acceptance)

- A read-only check of rejected post saves (error codes in the logs), so a hidden /create case shows up fast.
- No kill switch for now. If one is added later, it must never switch off the ownership or server-owned Mux protections.

## Technical details

- `mux_uploads.duration_rule_applies boolean not null default false`. Existing rows keep `false`. A BEFORE INSERT trigger always sets `true` (ignores any value sent). A BEFORE UPDATE trigger always keeps the old value, for every caller including webhooks and reconcile; changing it later needs a separately authorized migration.
- For Mux items, `provider`, `url` (poster vs playback), `thumbnail_url` and every `mux_*` field are rebuilt from the upload record, so a client-supplied URL or provider cannot make an unready or foreign video playable.
- `post_mux_truth_item(item, owner)` is modelled on `review_mux_truth_item`, but the over-60 branch depends on `duration_rule_applies`.
- `zz_posts_media_mux_before` (BEFORE INSERT/UPDATE OF media): if the media is unchanged, it returns early. Otherwise it compares counts against both the limits and the old counts, then for an untrusted caller maps each Mux item, matched by `mux_upload_id`, through the truth function. Trusted callers (the webhook patch) keep the patch-validity check. Its name sorts after `media_guard` and `enforce_post_edit_window_trigger`, and a test asserts that order through `pg_trigger`.
- `patch_content_media_from_mux` (post branch) and `sync_mux_post_mappings` / the reconcile path use the same truth function, so the 60 s rule is the same everywhere.
- Error codes: `post_media_too_many`, `post_video_too_many`, `post_video_not_owned`.
- New files: `supabase/tests/post_video_phase2.sql` and `docs/verification/post-video-phase-2.md` (with the historical rows and the storage-fallback limitation). roadmap.md also gets updated.
