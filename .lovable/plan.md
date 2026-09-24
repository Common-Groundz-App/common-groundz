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
- `/books`, `/movies`, `/places`, `/food` and `/products` go to Explore. Explore has no address that opens a single category, so plain Explore is the closest match. No new filter system gets built for this.
- **Signed-out visitors are treated the same as today.** The redirects sit behind the same sign-in check the old pages had. The old page code is deleted, but the old addresses still work as redirects.
- **Back button:** the redirect replaces the old address, so pressing Back does not reopen it.

## Already checked for outside links

- There is no sitemap in the project.
- No menu, footer, notification link, share link, settings file or search setting points at these six addresses. Only the category pages link to the product search page.
- The old hosting file mentions `/food/*`, which is a different pattern. Lovable hosting ignores that file, so it is left alone.

## Steps

1. **Proof before deleting.** List every file that points at each item: links, tests, delayed loading and notes. Confirm nothing live uses them. Shared pieces used only by these items are recorded, not deleted.
2. **Add the protected redirects** above.
3. **Delete** the eight files and remove their imports.
4. **Tests.** These check what the app does, not whether files exist:
   - Each old address redirects correctly, including searches with spaces, `&` and `+`.
   - The redirect replaces the history entry.
   - A signed-out visitor still meets the sign-in check first.

   The existing My Stuff tests confirm the picker still works. A text search, the type check and the build confirm nothing still uses the deleted files.
5. **Write the record** in the picture inventory, the roadmap and a new 6C note. Older reports are not edited. Then stop before 6D and report back.

## Technical details

- Delete: `src/pages/ProductSearch.tsx`, `src/pages/{Books,Movies,Places,Food,Products}Page.tsx`, `src/components/search/ProductResultItem.tsx`, `src/components/recommendations/RecommendationForm.tsx`.
- `App.tsx`: remove the six page imports and keep each route wrapped in `<AppProtectedRoute>`.
  - The five category routes render `<Navigate to="/explore" replace />`.
  - `/product-search/:query` renders a small `LegacyProductSearchRedirect`. It reads the `useParams` value, which React Router has already decoded, builds the target with `new URLSearchParams({ q, mode: 'quick' })` so the query is encoded exactly once, and uses `<Navigate replace>`.
- Keep: `EntitySearch.tsx` (MyStuff), `SearchResultHandler.tsx`, `useUnifiedSearch`, `ConnectedRingsRating`.
- In `group2aEntityThumbnails.test.tsx`, remove the `EntityResultThumbnail` import and its block.
- Record the orphans left by the deleted files, for example `useIsMobile` or `VerticalTubelightNavbar` if they end up unused. Do not delete them.
- New test `src/pages/group6cRetiredRoutes.test.tsx`, registered in vitest.config.ts. It uses a MemoryRouter with the real `AppProtectedRoute` and a mocked auth state, and covers:
  - `/product-search/books` → `/search?q=books&mode=quick`
  - `/product-search/skin%20care`, which decodes and re-encodes to a single `q=skin care`
  - `/product-search/a%26b%2Bc` → `q=a&b+c` exactly
  - the five category addresses → `/explore`
  - history length unchanged, confirming the history entry is replaced
  - signed-out behaviour identical to today.
- Static proof goes in the close-out note: `rg` shows zero references to the deleted modules.
