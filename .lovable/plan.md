# Group 6 — the last picture areas, the old entity pages, and unused code

Both reviews are right, and so is your worry. The confusion comes from one thing: **the same search box shows two different kinds of rows**, and only one kind was fixed earlier.

## Why the search box still has work (your Explore example)

When you type in a search box, the dropdown has sections:

- **"Already on Groundz"** — things already saved in the app. These rows were fixed in Group 2A. That is the icon you already see. **Nothing here changes.**
- **"Books", "Movies", "Places", "All Items"** — results fetched from outside sources (book, film and map services). These are drawn by a different piece of code that was never touched. Today, when one of them has no picture it shows the words **"No Image"**, and when its picture breaks it shows a random stock photo.

So Group 6 fixes the outside-result rows sitting next to the rows you already approved — not the same rows again.

## Screen map — where every Group 6 change happens

| Part | What you see | How to get there | Today | After |
|---|---|---|---|---|
| 6A | Outside-result rows in the search dropdown (Books / Movies / Places) | Home feed or Explore → type in the search box | "No Image" text, or stock photo if broken | Type icon on soft panel |
| 6A | Outside-result rows in the search popup | Header search button → type | Same | Same fix |
| 6A | "All Items" and category rows on the full search page | Search → press Enter, or open /search | Same | Same fix |
| 6A | Result rows on the product search page | Search for a product → product results page | Same | Same fix |
| 6A | "Add to My Stuff" picker — both "Previous Recommendations" and outside rows | My Stuff → **Add Item** → search | A hard-coded stock photo per type | Type icon on soft panel |
| 6A | What gets saved when you pick an outside result | Picking any outside row in the two places above | The picker can save the stock photo address onto your new item | Real picture saved, or no picture — never a fake one |
| 6B | Old entity pages v1, v2, v3 | Only internal team accounts, by adding `?v=1`, `?v=2`, `?v=3` or `?preview=true` to an entity link | Three old copies of the entity page | Deleted; every link shows the V4 page you use today |
| 6C | Nothing visible | — | Two unused files nobody opens | Deleted |
| 6D | Admin screens only | Admin area | Mixed old behaviour | Only the admin rows that show an entity's own saved picture change; decided row by row with you first |
| 6E | Small child cards in an entity page tab | Entity page with sub-items → the tab that lists them | No picture → no picture area (fine). Picture exists but breaks → stock photo | No picture → still no area. Broken → type icon inside the existing area |

Every row keeps its exact size, corners, crop, spacing, text and tap behaviour. Only the empty or broken picture changes.

## The sub-phases, one at a time

Each gate is finished, checked and shown to you before the next starts.

### 6A — outside search rows and the My Stuff picker (visual change)

1. Replace "No Image" and the stock photo in the outside-result rows with the type icon, in all four search places listed above (it is one shared row, so one change covers them all).
2. Replace the stock photos in both lists inside the My Stuff picker with the type icon. Real pictures — including map photos for places and food — stay exactly as today.
3. Saving check, for **both** ways an outside result becomes a new item (picking it from search, and picking it in the My Stuff picker): a real picture is kept; no picture saves as empty; an old stock placeholder saves as empty; an existing good picture is never overwritten. The search-row path is checked end to end and fixed only if a fake picture can get through.
4. Stop for your visual approval.

### 6B — retire the old entity pages (deletion, separate approval)

1. First I show you the exact deletion list and every place that points at them (links, tests, notes, the version switch, lazy loading). No deleting yet.
2. After your OK: delete v1, v2 and v3 and the switch that chose between them.
3. Check that stay working exactly as today: normal entity links, sub-item entity links, old renamed links that redirect, loading and not-found screens, signed-in and signed-out views, and the page title and share preview.
4. Stop and report.

### 6C — remove proven-unused code

1. Final proof that nothing uses the old product search row or the old recommendation form — including tests and delayed loading.
2. Delete those two only. The My Stuff picker's search code **stays**, because My Stuff still uses it.
3. If anything unexpected is found using either one, it stays and is recorded instead.

### 6D — admin, by what each picture means (decision first, then code)

1. I give you a table of every admin picture: which screen, what it shows, and one of: the entity's own saved picture / a candidate picture being reviewed / an upload preview / a suggested or duplicate record shown for comparison / a health check.
2. You approve which rows change. Default rule: only "the entity's own saved picture" gets the type icon. Anything shown so an admin can judge it — candidates, previews, suggestions, comparisons — keeps showing a broken picture as broken, because that is useful evidence.
3. Implement only the approved rows, then stop.

### 6E — the entity tab child cards

1. No picture → keep showing no picture area (layout unchanged).
2. Picture present and working → unchanged.
3. Picture present but broken, or an old stock placeholder → type icon inside the area that is already there.
4. Record the two cards that deliberately show no picture area at all — the My Stuff item card and the product list rows on an entity page — as accepted exceptions.

## What is still pending after Group 6

These are tidy-up jobs, not screen changes, and each gets its own plan:

1. **Old picture helper** (`ImageWithFallback`) — still used for non-entity pictures such as profile covers, upload previews and location photos, so it cannot simply be deleted. Decide whether to keep it for those only, remove its built-in stock photo, and remove its second-attempt retry.
2. **Old stock photo lists** — delete each one only once nothing uses it.
3. **Saved old stock photos in the database** — optional. Count items still holding a known old stock address, back up the list, clear only exact known ones, check nothing else changes.
4. **One central rule** — decide whether "old stock placeholders count as no picture" can move into the single place the app picks a picture, now that every screen agrees.
5. **Final inventory** — one last list proving every picture area is fixed, deliberately excepted, or retired.

Permanently left alone: the loading placeholder on entity pages, location search photos, and people's avatars, covers and initials.

## Technical details

- Files per gate. 6A: `src/components/search/SearchResultHandler.tsx` (rendered by `EnhancedSearchInput` on Feed/Explore, `SearchDialog`, `src/pages/Search.tsx`, `src/pages/ProductSearch.tsx`; local rows there are `EntityResultItem`, already migrated), `src/components/recommendations/EntitySearch.tsx` (via `AddToMyStuffModal` ← `MyStuffFilters` "Add Item"), creation paths `EntitySearch.handleSelectExternal` (currently `result.image_url || getImageUrl(result)`, which can yield a stock address) and `SearchResultHandler` → `useOptimisticEntityCreation` (`image_url: result.image_url`). 6B: v1 component inside `src/pages/EntityDetail.tsx` (lines 56–999), `src/pages/EntityDetailV2.tsx`, `src/components/entity-v3/`, `src/utils/entityVersionUtils.ts`; `EntityDetail.tsx` stays as the route and renders V4 only. 6C: `src/components/search/ProductResultItem.tsx`, `src/components/recommendations/RecommendationForm.tsx`. 6E: `src/components/entity-v4/EntityTabsContent.tsx` (~line 273).
- Rendering uses the existing shared pieces (`useEntityImageFallback`, `getEntityFallbackIcon`, `EntityCollectionImage`); no new fallback component. Source precedence preserved per surface; `ImageWithFallback` removed only from migrated slots.
- Persistence follows the existing real-URL-or-null contract (`getPersistableEntityImageUrl`): `null` exactly, never `''`, never a stock address; registered placeholders → `null`; legitimate unregistered Unsplash photos preserved.
- Fallbacks carry `role="img"` and an `aria-label` naming the entity; one real request, no stock request.
- Tests per gate: frame/class preservation, missing/broken/placeholder/unknown-type cases, legitimate-Unsplash preservation, "No Image" gone, both creation paths (real kept, none → `null`, placeholder → `null`, existing not overwritten), V4 route/child-route/redirect/`?v=` behaviour after 6B, zero-import proof for 6C. Plus full suite, typecheck, build log, and desktop/mobile fixtures, with close-out notes in `docs/verification/entity-image-fallback-inventory.md` and the roadmap.

On approval, only 6A is implemented; each later gate comes back to you first.
