# 3B audit: missing "too many photos" warning + location prompt answer

## What I found

**1. Missing warning (real bug, caused by 3B).**
In the shared photo uploader, the files you pick are cut down to the free slots (4 minus what's already added) *before* the new page reserves them. When you pick more than fit (e.g. 6 photos with 0 added), the uploader keeps 4, reserves 4, sees "all granted", and never shows the "Too many files selected — Only the first N files will be processed" warning. The popup doesn't reserve slots, so it still shows the warning. Other warnings work the same on both: "Media limit reached" when all 4 are used and you tap Add, invalid file, one video per review.

**2. Location prompt: it exists and works the same as the popup.** It shows on the photos step only when all of these are true:
- The subject's type is **Food, Place, Experience or Event**. Movies, books, products, apps, services, etc. never show it — the popup follows the same rule.
- Location isn't already turned on in the app, and the browser hasn't already granted location permission. If you allowed location before, you won't see it.
- It wasn't shown in the last 24 hours, and you didn't tap Skip in the last 2 hours.

One intended difference: the new page saves "last shown" when the prompt actually appears (the popup had a small bug and often didn't save it). So once you see it on the new page, it stays hidden for 24 hours.

**How to test by hand:** pick a restaurant/dish/place. In the browser's site settings, reset location permission to "Ask". In DevTools → Application → Local Storage, delete `locationPromptLastShown` and `locationPromptLastSkipped`. Reload and go to the photos step.

**3. Other 3B leftovers.** Nothing else is missing compared with the popup's photos step (subject card, "Dish at …" line, read-only old title/place, media grid, counter text, hint). The known limits already written down (Forward after leaving, rare extra Back press) stay as they are.

## Fix

- Shared photo uploader: when slots are reserved, compare against the **original** number of files picked, not the already-cut list. Show "Too many files selected — Only the first N files will be processed." whenever fewer files are accepted than you picked. Wording stays identical to the popup's. The popup's behavior doesn't change (it doesn't use slot reservation).
- Add a test: picking 6 files with 0 added (and 3 files with 2 added) on the reserved-slot path shows the warning, and the popup path stays the same.
- Add a "Location prompt — how to trigger" section and a step for the "too many photos" warning to the signed-in re-test in the 3B verification doc.

## Technical details

- `src/components/media/MediaUploader.tsx` `handleFileSelect`: compute `const picked = files.length`; on the `reserveSlots` path call `reserveSlots(Math.min(picked, remainingSlots))` and show the toast when `granted < picked`. The non-reserve branch is unchanged.
- New vitest in `src/components/review-composer/__tests__/` rendering MediaUploader with a mocked `reserveSlots` and `useToast`.
- No changes to the location policy, the store or the navigation guard.
