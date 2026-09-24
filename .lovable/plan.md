# Group 6D: admin screens, sorted by what each picture is for

## 6C check result

6C is complete with nothing left over:
- The eight files are gone and nothing links to them.
- My Stuff still uses its picker.
- 818 checks pass and the build is clean.

## Where to find each change (Admin page)

| Where | What you see |
|---|---|
| Admin → **Entities** tab → the entity table | 48×48 picture at the start of each row |
| Admin → **Entities** → pencil (edit) on a row → "Image URL" field → **Preview** | the manual picture preview |
| Admin → **Entities** → **New Entity** → "Did you mean one of these?" window | the pictures of existing look-alike entities |
| Admin → **Entities** → **New Entity**, or the edit page → **"Part of"** field | the chosen parent and the search list under it |
| Admin → **Moderation** tab → pending entities list | 48×48 box on each row |
| Admin → **Content** tab → "Entity AI Summaries" list | 48×48 picture on each row |
| Admin → **Suggestions** tab → the "Entity" column | 40×40 picture |
| Admin → **Claims** tab → "Brand Claims Management" table | 40×40 picture |
| Admin → **Claims** → open a claim → review window | 64×64 picture |
| Admin → **Relationships** tab (product relationships) | the two pictures on each relationship card |

## How the pictures are split

### A. Entity's own picture: switch to the shared type-icon panel

This covers the Entities table, Moderation list, Content list, Suggestions column, Claims table, claim review window and the "Part of" picker.
- Missing, broken or old stock placeholder → the soft panel with the type icon, in the same frame.
- In the Entities table, the "No Image" words become the icon, which has a screen-reader label.

**Relationships tab: a special case.** Today it shows no picture box at all when an entity has no picture. That stays the same, so nothing shifts in the card. Only when a picture is present but broken, or is an old stock placeholder, does the icon appear, in the same 48×48 space the picture already takes.

### B. Evidence pictures: not touched

These stay as they are: image candidates, upload previews, auto-fill preview, search candidates during creation, photo moderation, image health and user avatars.

### C. Comparison and preview spots: show the truth

This covers the "Did you mean one of these?" window and the edit page Preview.
- **Stock-photo swap removed.** Neither spot uses the type icon either.
- **The Preview shows exactly the link typed in the field.** A different stored photo can no longer hide a bad link. The Preview still appears only when a link exists.
- **When the picture fails to load**, the same frame shows a clear "Image failed to load" state with a small broken-image symbol, instead of the browser's unclear default. A screen-reader label names the entity.

## Steps

1. Switch the group A spots to the shared type-icon panel. Keep the Relationships rule above.
2. Update the group C spots as described. Leave group B and every admin action untouched.
3. Run tests, grouped by what each picture is for:
   - **Entity's own picture:** real picture, missing, broken, old placeholder, unknown type, switching to another entity resets the state, frame unchanged.
   - **Relationships:** no picture means no box. A broken picture shows the icon inside the existing box.
   - **Comparison and preview:** the exact link is tried, a failure shows "Image failed to load", and no stock photo, type icon or substitute photo appears.

   Then run the full test suite, the type check and the build.
4. Record the work in the inventory, the roadmap and a new 6D note. Stop before 6E.

## Technical details

- Group A uses `EntityCollectionImage` inside the existing wrappers.
  - Whole entity, which keeps the optimal source: AdminEntitiesPanel, AdminEntityManagementPanel, AdminSuggestionsPanel, ClaimReviewModal.
  - `{ id, image_url }` only, which keeps the raw source: ParentEntitySelector, AdminClaimsPanel, PendingEntitiesQueue, AdminProductRelationshipsPanel.
- AdminProductRelationshipsPanel keeps the `image_url &&` guard. `EntityCollectionImage` is used only inside it.
- ParentEntitySelector puts its size classes (`w-8 h-8 rounded`, `w-10 h-10 rounded`) on both the image and the fallback span.
- Icon sizes: h-4 w-4 at 32px, h-5 w-5 at 40–48px, h-6 w-6 at 64px.
- Group C adds a small local `EvidenceImage` component in `src/components/admin/EvidenceImage.tsx`.
  - It renders `<img>` with the same classes.
  - On error it renders a span with the same classes, `bg-muted`, a lucide `ImageOff` icon, the text "Image failed to load" (at 48px the text is screen-reader only and only the icon shows), `role="img"` and `aria-label="Image failed to load for {name}"`.
  - It does not retry and does not use the placeholder registry.
- AdminEntityEdit uses `src={entity.image_url}` directly and drops `getOptimalEntityImageUrl` there. The `entity.image_url &&` guard is unchanged.
- `ImageWithFallback`, `getOptimalEntityImageUrl`, the stock helpers, the database and the schema are all unchanged.
- New test `src/components/admin/group6dAdminImages.test.tsx`, registered in vitest.config.ts.
