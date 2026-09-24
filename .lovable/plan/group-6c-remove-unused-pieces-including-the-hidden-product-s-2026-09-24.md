# Group 6C: remove unused pieces, including the hidden product search page (no redirects)

## 6B check result

6B is complete with nothing left over:
- The entity doorway only opens the V4 page. It has no redirects and never rewrites the address.
- The old v2 page, the v3 folder and the version-switch helper are gone. No live code mentions them.
- Only the old phase reports mention them. They stay unchanged on purpose, as history.
- The old loading placeholder and old reviews summary are still recorded as unused. They go on the later tidy-up list.

## Where the "product search page" is

It exists, but nobody can reach it through the app.

- **Address:** `/product-search/<word>`
- **Who links to it:** only five old category pages (`/books`, `/movies`, `/places`, `/food`, `/products`).
- **Who links to those five pages:** nothing. There is no menu entry, button, notification, share link or sitemap that points to them.
- **The real search box** goes to `/search?q=...`

## What 6C removes

| Item | Reachable today? |
|---|---|
| The product search page and its `/product-search/...` address | Only by typing the address |
| The Books, Movies, Places, Food and Products pages and their addresses | Only by typing the address |
| The old product result row | No |
| The old recommendation form (retired in Phase 4) | No |

**No redirects.** As you decided, the six old addresses are removed completely. Anyone who opens one will see the normal "page not found" screen. Nothing in the app uses these addresses, so current screens are not affected.

What stays: the main search page, the search box, Explore, My Stuff and its "Add Item" picker, and every shared piece that other screens use.

## Steps

1. **Proof before deleting.** List everything that points at each item, including links, tests and notes. Confirm that nothing in use depends on them.
2. **Delete** the eight files, their six address entries and their imports.
3. **Tests** that check what the app does:
   - The six old addresses now show the normal "not found" page.
   - `/search`, `/explore` and `/my-stuff` still open as before.
   - The existing My Stuff tests still pass.
   - A text search, the type check and the build confirm that nothing still uses the deleted files.
4. **Write the record** in the picture inventory, the roadmap and a new 6C note. Older reports are not edited. Then stop before 6D and report back.

## Technical details

- Delete: `src/pages/ProductSearch.tsx`, `src/pages/{Books,Movies,Places,Food,Products}Page.tsx`, `src/components/search/ProductResultItem.tsx`, `src/components/recommendations/RecommendationForm.tsx`.
- `App.tsx`: remove the six imports (lines 28–33) and the six `<Route>` blocks (lines 199–228). The `*` → `NotFound` route handles them. No `Navigate` is added.
- Keep: `EntitySearch.tsx`, `SearchResultHandler.tsx`, `useUnifiedSearch`, `ConnectedRingsRating`.
- `group2aEntityThumbnails.test.tsx`: remove the `EntityResultThumbnail` import and its block.
- Record any orphans the deletions leave behind. Do not delete them in this step.
- New test `src/pages/group6cRetiredRoutes.test.tsx`, registered in vitest.config.ts. It renders the real `App` route table with page components mocked. It asserts that each old path renders `NotFound`, and that the kept paths render their pages. It does not check whether files exist on disk.
- The close-out note records the `rg` search showing zero references to the deleted modules.
