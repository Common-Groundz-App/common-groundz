# Media lifecycle audit (Oct 9) — read-only, nothing deleted

## 1. Deletion report (bucket `post_media`, all 12 exist in storage)

Reference check (fresh, Oct 9): exact file-name match against posts.media, reviews.media/image_url,
review_updates.media, entity_photos.url, entities.image_url/stored_photo_urls, entity_suggestions.suggested_images,
entity_products.image_url, cached_products.image_url, cached_photos (3 url cols), profiles.avatar_url/cover_url,
notifications.image_url, photo_reports.photo_url, media_views.media_path, mux_upload_mappings, mux_uploads (whole row).
No check errored. Matching on file name covers full URL, signed URL and bucket-path forms.

KEEP (1 reference each, review_updates.media):
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/2089acf7-7261-4976-9c8a-7a2c84441c5b.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/57580837-b478-4562-927b-df041726576b.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/b063d2b4-e02b-4740-9bcd-4c9c012a9b5f.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/d7bee9e1-0d13-41e8-b6bd-b316790d8928.png

DELETE CANDIDATES (0 references anywhere):
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/0fd6a00c-1a58-4676-9608-6c03362acbeb.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/3acac8bc-746f-400a-9ef1-a160c971a21f/dc0c15a1-6a33-403d-a24f-f7e00e0c787f.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/3c58738b-d49b-4e39-818f-7b74cb7a1f00.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/79d638f7-c62e-4a01-a910-da7ba4df8ac3.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/993196a5-d6a4-4253-a940-ea67e7a5326d.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8162b991-72ef-46ba-acd3-4c3c7d80a7ae/af8c8aaa-e71f-4bd3-b88f-2a1d689e8118.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/47b425d6-20ae-4878-99af-d278501fe2f1.png
- c8508bd3-35a9-4cce-a7c8-0b5fc2bca965/8d661012-2a9c-4f43-810e-f2b8dec9216f/78a542b6-4b1f-41fe-bb49-174b01a55ae8.png

## 2. Lifecycle (photos)

| Case | New pages | Old pop-up forms |
|---|---|---|
| Over limit | refused before upload | refused (same uploader) |
| New upload removed, confirmed save | deleted | **left behind** |
| Cancel | session uploads deleted, saved media kept | not deleted by the form |
| Unclear save | nothing deleted | n/a |
| Saved media removed during Edit | **left behind** (committedLeftovers excludes stored media) | **left behind** |
| Tab close / reload | may be left behind | may be left behind |
| Whole thread deleted | server returns mediaToClean, browser deletes (retry once) | same |

## 3. Videos
- What's saved: the poster image is in `post_media`, and the video itself is hosted by Mux (asset and playback IDs in `mux_uploads`).
- `deleteMedia` removes only the poster. Nothing in the code deletes a Mux asset.
- Mux mappings support content type `post` only. The live data has 0 reviews or updates with video and 0 non-post mappings, so in practice video in reviews and updates is unused or unlinked.
- Removed or abandoned review videos would leave both the poster and the hosted asset behind.

## 4. Existing sweep (`cleanup-orphan-media`, `-execute`)
- A weekly dry run is scheduled; 27 runs so far, the latest on Oct 4. The execute function has a 7-day age floor and a cap of 50 deletions.
- **Unsafe to enable as is.** It only collects references from posts, reviews, review_updates, entity_photos and entities.image_url. `entity_suggestions.suggested_images` holds 1 `post_media` file today that the sweep would treat as an orphan. It also ignores entities.stored_photo_urls, profiles, cached tables, and video records.

## 5. Proposed fix (not built)
1. On a confirmed edit, the server records removed stored media as candidates in a pending list. Nothing happens on Cancel or when the save result is unclear.
2. A server job re-checks every reference source from section 1, normalising URLs to bucket paths. It deletes only files with zero references, retries failures, and keeps anything uncertain.
3. Extend the sweep's reference list to every source in section 1 before any deletion is enabled.
4. Videos: delete the poster and the Mux asset together, only after a zero-reference check. Before building this, register review and update content types in the Mux mappings, or block video on reviews.
5. Optional: route the old pop-up forms through the same candidate list.

---

# Follow-up (Oct 9, revision-3 plan)

## A. Deleting the 8 — blocked, nothing deleted
This project's backend gives me read-only access with no admin storage key, so I can't delete through the storage API. SQL deletes on storage tables are ruled out. Next step: the owner deletes the 8 listed paths in the Supabase dashboard (Storage → post_media), then I re-check read-only that the 8 are gone and the 4 kept photos are still there.

## B. Photo-only review/timeline forms — built
- `MediaUploader` has an optional `allowVideo` prop, default true, so posts and home are unchanged.
  - When it's false, videos are filtered out of both picking and drag-and-drop **before** any photo slot is reserved or upload starts, and a "Photos only" toast shows.
  - The file picker only offers image types, and the wording reads "Add photos".
- `CompactMediaGrid` has an optional `canRemove`. The review forms hide Remove on videos, so an existing video can't be removed or replaced in Edit, but it still plays, counts toward the 4, and is saved unchanged.
- This applies to four places: the new review page, the new timeline page, the old review pop-up (step 3) and the old inline timeline form.
- Tests are in `__tests__/photoOnlyReviews.test.tsx`: drop refused, no slot or upload, mixed drop keeps photos, picker has images only, post default unchanged, no Remove on videos. The related suites pass, with 368 passed.

## C. Mux videos never linked back (read-only)
- Test uploads: 13 (12 ready, 1 waiting), May 20–28. Origin unknown.
- Non-test uploads: 3, all ready with a hosted asset, from the same user on Jun 1, Oct 5 and Oct 6 2026. Their playback IDs appear in **no** post, review or timeline update. Origin is **unknown**. The Oct 5–6 dates line up with 3B testing, but that isn't proven.
- These hosted videos can't be deleted by anything in the app today. They're candidates for the later "Mux for reviews" phase. Nothing was done to them.

## D. Cleanup design
This is the corrected design from the approved plan: states, a per-file transaction lock, checks only on newly added paths, a two-step worker where the database step commits *deleting* before the storage call, coverage of the columns listed in section 1, and a report-only sweep. **Not built.**

## A. Verified complete (Oct 9, 11:05 UTC — deletion by owner via dashboard)
- All 8 listed objects are absent from `storage.objects`, and their public URLs return 400.
- The 4 kept photos are present and their public URLs return 200 image/png.
- Timeline updates 1414f4f9… and 9884785f… (review 8fa6b2a4…) still list exactly those 4 URLs, 2 each. Their `updated_at` is unchanged from Oct 8, and no database content changed.
- The dashboard left an `.emptyFolderPlaceholder` in session folder 8162b991…. It's harmless and unreferenced.
- Not verified in a signed-in browser (external auth). The data and URLs show the photos will display.
