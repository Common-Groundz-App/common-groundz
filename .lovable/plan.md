# Step 4 finish + Step 5 plan

## Step 4 check (done, read-only)
Your manual deletion worked, but it was a **soft delete** — the row is still in the database, marked deleted, and still carries the stock photo link:
- "Learn HANA in 1 Day" (id 3785f92d-…): `is_deleted = true`, stock link still stored.
- All other live tables are clean: no stock links in active entities, photos, products, reviews, profiles, notifications, or caches.
- Two internal history logs (image_health_results: 12 rows, image_migration_results: 6 rows) still mention stock links — these are service-role-only audit records of past checks, not displayed anywhere. Recommendation: leave them as history.

## Step 4 finish — remove the leftover
Since all current data is dummy and you confirmed deletion:
1. Hard-delete the soft-deleted row, guarded by the exact stock link so nothing else can be touched:
   `delete from entities where id = '3785f92d-…' and is_deleted and image_url = '<exact stock link>';` — expect 1 row.
2. Recount: zero stock links in `entities` (active or deleted), total 353 → 352.
3. Document in docs/verification/post6-step4-db-placeholder-cleanup.md; tick Step 4 in roadmap.md.

## Step 5 — final decision + inventory
1. **getOptimalEntityImageUrl decision — recommendation: leave it unchanged.**
   Verified: it returns `entity.image_url` directly (stored photos → storage URLs → external URLs) and does not filter registered placeholders itself. That is fine because every screen resolves images through the shared contract (EntityImage / useEntityImageFallback / EntityCollectionImage), which already treats registered placeholders as missing. Changing it would duplicate the filter in two places with no visible effect.
2. **Final inventory audit:** update docs/verification/entity-image-fallback-inventory.md so every picture area is marked migrated, a deliberate exception, or retired — including the server functions (Step 3f) and the database (Step 4).
3. Run the full suite (862 tests), typecheck, and build to confirm nothing regressed; tick Step 5 in roadmap.md.

## Not changing
- No code, layout, schema, or other records. The placeholder registry and internal audit logs stay.

## Technical details
- Step 4 is a one-off guarded data delete via the SQL tool (not a schema migration); verification reuses the count query from the audit.
- Step 5 touches only documentation files plus the roadmap; the getOptimalEntityImageUrl decision is documented as "unchanged, with rationale" in the inventory doc.
