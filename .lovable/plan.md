# Step 4 — Delete the one entity with a saved stock photo

## Step 3 check (done, read-only)
- No leftover stock-photo helpers anywhere in the app or server functions.
- Remaining stock-photo links are all known, deliberate: the placeholder list itself (used to recognise old stock links), test fixtures, the profile default cover, the review avatar default, the location food photo, the reviews-section founder photo, and the image relay's allowed-domain lists. None invents an entity image.

## What the records hold today
- 353 entities in total; exactly 1 has a stock photo link, and it matches the known placeholder list:
  - "Learn HANA in 1 Day" (book, active) — generic book stock photo.
- No other stock links exist.

## What changes
Per your confirmation that all current data is dummy and doesn't need preserving:
1. Delete the entity "Learn HANA in 1 Day" (id 3785f92d-60f3-4aee-9e5e-ae80a5dab464), guarded so it only runs if the record still carries that exact stock link.
2. Recount afterwards: stock links in records = 0, entity total drops 353 → 352, no other record touched.
3. Document in docs/verification/post6-step4-db-placeholder-cleanup.md; tick Step 4 in roadmap.md; stop before Step 5.

## Not changing
- No code, layout, schema or other records. The placeholder list stays (harmless safety net for any old links cached elsewhere).

## Technical details
- One-off data delete (not a schema migration), guarded by the exact link:
  `delete from entities where id = '3785f92d-60f3-4aee-9e5e-ae80a5dab464' and image_url = 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000';` — expect 1 row.
- Verify with the same count query (unsplash_total = 0, registered = 0, total = 352).
- Alternative: you can delete it yourself from the admin panel — the result is identical; the guard just makes the scripted route safe.
