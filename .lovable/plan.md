# Group 6D: admin screens, sorted by what each picture is for

## 6C check result

6C is complete with nothing left over:
- The eight files are gone.
- The app has no remaining links to them or references to their addresses. The only mention is the new check that confirms the six old addresses show "not found".
- My Stuff still uses its picker.
- All 818 checks pass, and the build is clean.

## How admin pictures are split

The rule you approved: only a picture that is **the entity's own picture** gets the soft panel with its type icon. Pictures that admins are **judging or comparing**, such as candidates, uploads, suggestion or duplicate comparisons and health checks, must show exactly what is there. A broken picture stays visibly broken, because that is useful evidence.

### A. Entity's own picture: switch to the shared type-icon panel

| Admin screen | Size | Today when missing or broken |
|---|---|---|
| Entities list (admin portal) | 48×48 | random stock photo |
| Entity management table | 48×48 | "No Image" text, or stock photo if broken |
| Parent picker: the chosen parent and the list rows | 32×32 / 40×40 | stock photo |
| Claims table | 40×40 | stock photo |
| Claim review window | 64×64 | stock photo |
| Suggestions table: the entity column | 40×40 | stock photo |
| Pending entities queue | 48×48 | empty grey box, or broken-image icon |
| Product relationships (both sides) | 48×48 | broken-image icon |

### B. Evidence pictures: kept as they are

These stay untouched: image candidate grid, upload previews (create dialog and uploader), auto-fill preview, create-search candidate rows, photo moderation, image health panel, user avatars.

### C. Two comparison and preview spots: one small change

- **Duplicate check window.** It shows existing entities so an admin can compare them.
- **Entity edit, the "Preview" of the manual picture link.**

Today both quietly swap a broken picture for a stock photo. That hides the problem you are supposed to catch. Under your rule they should show the real picture, and a broken one should look broken. The only change here is removing the stock-photo swap. Nothing is added.

## Steps

1. Switch the group A spots to the shared type-icon panel. Every size, corner, crop and layout stays the same. The "No Image" text in the management table becomes the icon, with a screen-reader label.
2. Remove the stock-photo swap from the two group C spots. They become plain pictures in the same frames.
3. Leave every group B spot, and all upload, refresh and moderation actions, untouched.
4. Test each group A spot:
   - a real picture still shows
   - a missing picture shows the icon
   - a broken picture shows the icon, with no second download
   - an old stock placeholder shows the icon
   - an unknown type shows the neutral icon

   Test the group C spots: a broken picture stays broken and no stock address appears. Then run the full test suite, the type check and the build.
5. Record the work in the picture inventory, the roadmap and a new 6D note, then stop before 6E.

## Technical details

- Group A uses `EntityCollectionImage` (source, type, name, imageClassName, iconClassName) inside the existing wrapper divs.
  - Places that already call `getOptimalEntityImageUrl` keep it and pass the whole entity: AdminEntitiesPanel, AdminEntityManagementPanel, AdminSuggestionsPanel and ClaimReviewModal.
  - Places that read `image_url` directly pass only `{ id, image_url }`, so the source order stays the same: ParentEntitySelector, AdminClaimsPanel, PendingEntitiesQueue and AdminProductRelationshipsPanel.
- ParentEntitySelector has no wrapper today, because its size classes sit on the image itself. For the icon case the same `w-8 h-8 rounded` and `w-10 h-10 rounded` classes go on the fallback span, so its size is unchanged.
- Icon sizes: h-4 w-4 at 32px, h-5 w-5 at 40–48px, h-6 w-6 at 64px.
- Group C (DuplicateConfirmDialog, AdminEntityEdit preview): replace `ImageWithFallback` with a plain `<img>` using the same classes, with no onError swap.
- `ImageWithFallback` itself, `getOptimalEntityImageUrl`, the stock helpers, the database and the schema are all unchanged.
- New test `src/components/admin/group6dAdminImages.test.tsx`, registered in vitest.config.ts.
