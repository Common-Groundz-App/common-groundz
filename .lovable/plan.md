# Step 4 — Tidy up the one saved stock photo

## Step 3 check (done, read-only)
- No leftover stock-photo helpers anywhere in the app or server functions.
- Remaining stock-photo links are all known, deliberate: the placeholder list itself (used to recognise old stock links), test fixtures, the profile default cover, the review avatar default, the location food photo, the reviews-section founder photo, and the image relay's allowed-domain lists. None invents an entity image.

## What the records hold today
- 353 entities in total; exactly 1 has a stock photo link, and it matches the known placeholder list:
  - "Learn HANA in 1 Day" (book, active) — generic book stock photo.
- No other stock links exist, so nothing legitimate is at risk.

## What changes
1. Save a backup of that one record's id and old link in the verification notes.
2. Set that one record's image to empty (null), only if the link still matches exactly (guarded update, so a newer real image is never overwritten).
3. Recount: stock links in records = 0, total entities still 353, no other record touched.
4. On screen nothing changes — the app already shows the book icon for this entity because it treats the stock link as missing.

## Not changing
- No code, layout, schema or other records. The placeholder list stays (harmless safety net for any old links cached elsewhere).

## Technical details
- One-off data update (not a schema migration):
  `update entities set image_url = null where id = '3785f92d-60f3-4aee-9e5e-ae80a5dab464' and image_url = 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000';` — expect 1 row.
- Verify with the same count query (unsplash_total = 0, registered = 0, total = 353).
- Document in docs/verification/post6-step4-db-placeholder-cleanup.md; tick Step 4 in roadmap.md; stop before Step 5.
