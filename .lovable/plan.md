# Phase 2 — Old Posts report (read-only, 2026-10-14)

Nothing was changed. All counts come from production data.

## Results

| Check | Result |
|---|---|
| Posts total | 161 |
| Post videos total | 38 (17 on live posts) — 16 Mux, 22 older stored files |
| Posts with more than 4 media items | **0** |
| Posts with more than 1 video | **0** |
| Post videos over 60 s | **0** (longest is 32 s) |
| Mux videos with unknown length | 0 |
| Mux videos with no link record | **2** (1 on a live post, 1 on a deleted post) |
| Videos with no stable identity (no upload ID, playback ID or file address) | **0** |
| Mux videos pointing to an upload we have no record of | 0 |
| One upload used by more than one post | 0 |

## The two unlinked videos

Both finished processing at Mux ("ready"), but because the second linking request never happened, the post still says "preparing". This is exactly the stuck-video bug Phase 3 removes.

- Live post `d4941fd5-c594-433b-9501-9d339482f55b` (2026-05-21, 8 s) — viewers see it stuck on "Video processing".
- Deleted post `3e5b7e00-1c4b-49ca-8cc3-9cc1f31b5b6f` (2026-05-23, 10 s) — not visible to anyone.

## What this means for enforcement

- No old post breaks the 4-item, 1-video or 60-second rules, so the new rules will not lock any existing post. The grandfathering protection stays in anyway, as a safety net.
- Every video already has a stable identity, so Phase 4 needs no special fallback decision.
- The 22 older stored-file videos have no Mux details. They are identified by their file address and are left untouched.

## Decision needed before enforcement

For the stuck live post: repair its link once (the video would then play normally — it is never marked as "new" for the 60-second rule), or leave it as-is. The recommendation is to repair it, using the trusted server path, as the first step of the Phase 2 build.

## Next (only after approval)

Phase 2 build: the post server rules from the approved plan (limits, 60 s for new videos only, server-owned video state, uploader must be the author), plus the optional one-time repair above. Then stop and report.
