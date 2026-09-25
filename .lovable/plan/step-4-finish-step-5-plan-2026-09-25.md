# Step 4 finish + Step 5 plan

## Step 4 check (done, read-only)
Your manual deletion worked, but it was a **soft delete** — the row is still in the database, marked deleted, and still carries the stock photo link:
- "Learn HANA in 1 Day" (id 3785f92d-…): `is_deleted = true`, stock link still stored.
- All other live tables are clean: no stock links in active entities, photos, products, reviews, profiles, notifications, or caches.
- Two internal history logs (image_health_results: 12 rows, image_migration_results: 6 rows) still mention stock links — these are service-role-only audit records of past checks, not displayed anywhere. Recommendation: leave them as history.

## Step 4 finish — clear the leftover photo link (no hard delete)
Your soft delete already did the app's normal deletion. The only leftover is the stored photo link, so we clear just that and keep the row. A hard delete isn't needed for this project and could remove or blank out linked records.
1. Guarded update: set only `image_url = null` on that one row, only if it is still soft-deleted and still holds that exact stock link. Must affect exactly 1 row.
2. Verify: that row is soft-deleted with no photo link, and zero registered stock links remain across all entities, active and deleted. The entity total is recorded for information only, not as a pass/fail check.
3. Keep the internal history logs unchanged.
4. Write docs/verification/post6-step4-db-placeholder-cleanup.md (saving the old link as the record) and tick Step 4 in roadmap.md.

## Step 5 — final decision + inventory
1. **Leave getOptimalEntityImageUrl unchanged.** Its job stays "pick the best real image". Recognising old placeholders, missing and broken images, and showing the icon stays in the shared picture layer. Documented wording: every kept entity picture area has either moved to the shared layer or is recorded as a deliberate exception (optional slot, evidence, loading, non-entity image), so the picker doesn't need its own filter.
2. **Final inventory:** every picture area and helper gets exactly one label: migrated, optional slot, evidence, loading, non-entity image, retired, server fixed, old data cleaned, audit history kept, deliberate remote exception, dead helper removed, picker unchanged. The inventory also confirms:
   - no app code or server search still makes up stock photos;
   - no entity record, active or deleted, still holds a registered placeholder;
   - the placeholder list stays as a safety net for old cached data;
   - the three search functions were deployed and smoke-tested in Step 3f, including the one path not seen live (a book with no cover).
3. **Extra checks I'd add:** a final project-wide search for stock-photo links and the old helper names, and a fresh live search to confirm the search functions still return real photos or none.
4. Run the full test suite, typecheck and build. Mark the image-fallback project complete in roadmap.md only if nothing is left unclassified or unverified. Otherwise list what's still open.

## Not changing
- No code, layout, schema or other records. The placeholder list and internal audit logs stay.

## Technical details
- Step 4 is a single guarded data update through the SQL tool, not a schema change:
  `update entities set image_url = null where id = '3785f92d-60f3-4aee-9e5e-ae80a5dab464' and is_deleted is true and image_url = 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000' returning id, is_deleted, image_url;`
- Verification: a registered-placeholder count on `entities` with no is_deleted filter must return 0.
- Step 5 only changes documentation files and the roadmap.
