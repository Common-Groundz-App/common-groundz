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
