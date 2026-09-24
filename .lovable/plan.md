# Group 6C — remove unused pieces (including the hidden product search page)

## 6B check result

6B is complete with nothing left over:
- The entity doorway only opens the V4 page. It has no redirects and never rewrites the address.
- The old v2 page, the v3 folder and the version-switch helper are gone. No live code mentions them.
- Only the old phase reports mention them, and those are left alone on purpose as history.
- The two pieces that only the old pages used, the old loading placeholder and the old reviews summary, are still recorded as unused. They go to the later tidy-up list, as agreed.

## Your question: where is the "product search page"?

It exists, but nobody can reach it by normal use.

- **Address:** `/product-search/<word>`, for example `/product-search/books`.
- **What it shows:** a "Results for ..." page with a "From CommonGroundz" list and a "From the Web" list.
- **Who links to it:** only five old category pages: `/books`, `/movies`, `/places`, `/food` and `/products`. Each has two "search" buttons that lead there.
- **Who links to those five pages:** nothing. No menu, button or link in the app opens them. You can only get there by typing the address by hand.
- **The main search box** (home, Explore and the header) goes to `/search?q=...`, not to this page.

So the product search page, and the five category pages that lead to it, are leftovers from an older design. In 6A I updated its picture rows because the page still technically works. I should have told you it was unreachable. That change was harmless, but it isn't needed.

## What 6C removes

| Item | What it is | Reachable today? |
|---|---|---|
| Product search page and its `/product-search/...` address | Old results page | Only by typing the address |
| The Books, Movies, Places, Food and Products category pages and their addresses | Old category pages, the only way into the page above | Only by typing the address |
| The old product result row | Search row nothing draws | No |
| The old recommendation form | Form retired in Phase 4, nothing opens it | No |

What stays: the main search page, the search box, the "Add to My Stuff" picker (the old form used it, but My Stuff still does), Explore, and every shared piece that other screens use.

**Old typed addresses do not break.** Instead of showing "not found":
- `/product-search/<word>` goes to the main search for that word.
- `/books`, `/movies`, `/places`, `/food` and `/products` go to Explore.

## Steps

1. **Proof before deleting.** List every file that points at each item: links, tests, delayed loading and notes. Confirm nothing live uses them. Shared pieces used only by these items are recorded, not deleted.
2. **Add the redirects** above, so old addresses land somewhere useful.
3. **Delete** the items in the table, and remove their address entries.
4. **Tests.** Move the small picture test for the product search row out of its current test file, because it goes with the page. Add checks that:
   - the old addresses redirect correctly
   - the deleted files are gone and nothing imports them
   - My Stuff's picker still works.

   Then run the full test suite, the type check and the build.
5. **Write the record** in the picture inventory, the roadmap and a new 6C note. Older reports are not edited. Then stop and report back.

## Technical details

- Delete: `src/pages/ProductSearch.tsx`, `src/pages/{Books,Movies,Places,Food,Products}Page.tsx`, `src/components/search/ProductResultItem.tsx`, `src/components/recommendations/RecommendationForm.tsx`.
- `App.tsx`: remove those imports. Replace the six routes with `<Navigate replace>`. For `/product-search/:query`, a tiny inline component → `/search?q=<encoded query>&mode=quick`, matching the search box. The five category paths go to `/explore`.
- Keep: `EntitySearch.tsx` (MyStuff), `SearchResultHandler.tsx` (live search rows), `useUnifiedSearch`, `ConnectedRingsRating`.
- In `group2aEntityThumbnails.test.tsx`, drop the `EntityResultThumbnail` block. It is only exported from ProductSearch.
- Check for orphans that the deleted files alone imported (for example the `hooks/feed/api/types` `EntityTypeString` or the category-page-only components) and record them. Do not delete them.
- New test `src/pages/group6cRetiredPages.test.tsx`: redirect cases, a zero-importer file check and existence checks. Register it in vitest.config.ts.
