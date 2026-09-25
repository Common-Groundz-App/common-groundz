# Post-6 Step 4 — saved stock-link cleanup

- Before: 353 entities; 1 held a registered placeholder: 3785f92d-60f3-4aee-9e5e-ae80a5dab464 "Learn HANA in 1 Day" (book), soft-deleted by the owner.
  Old link (record): https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=1000
- Action: guarded update (id + is_deleted + exact link) setting image_url = null. Returned exactly 1 row: is_deleted true, image_url null. No hard delete, so no linked records were affected.
- After: 0 Unsplash links in entities (active and deleted). Total is 353 (for information only).
- Other tables: no stock links in live tables. image_health_results (12) and image_migration_results (6) are service-role audit history and were kept on purpose.
