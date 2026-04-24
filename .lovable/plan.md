
# Restore inline “See More / See Less” on Explore + Search — final ship version

The orange inline toggle exists in the UI but was disconnected from rendering during the ranking refactor. We will restore real expand/collapse on **both** dropdowns, with every reviewer-recommended safeguard included.

Scope: `src/utils/searchRanking.ts`, `src/pages/Search.tsx`, `src/pages/Explore.tsx`. We will **not** touch `EnhancedSearchInput.tsx` or `SearchDialog.tsx` (separate, working surfaces).

---

## What's broken today

1. Search renders only `cat.visible`, so clicking “See More” changes the label but not the list.
2. Explore stopped passing the canonical category key into `renderSectionHeader`, so the toggle no longer appears at all.
3. Search's toggle button has no `type="button"`, so clicking it submits the form and closes the dropdown.
4. Expand state isn't reset on query change (or page switch), so it leaks across searches.
5. Keyboard `aria-activedescendant` can point at a row that no longer exists after collapse or after a new query.
6. Search uses `'localResults'` as a state key while the ranking pipeline emits `'entities'` — keys drift.

---

## Fix plan

### 1. Make `softCollapse` carry the full ranked list — same array reference

In `src/utils/searchRanking.ts`, extend `CollapsedCategory<T>` with a new field. **Additive only** — do not rename or remove `visible`/`hidden`/`topScore`:

```ts
export interface CollapsedCategory<T> {
  key: string;
  visible: T[];
  hidden: T[];
  allItems: T[];   // NEW: same ranked array, NOT re-sorted
  topScore: number;
}
```

`softCollapse` populates `allItems` from the **same already-sorted reference**, so slices are guaranteed prefixes — expanding can never reorder visible rows:

```ts
return ranked.map((cat) => {
  const items = cat.items;            // already sorted by rankCategories
  let visibleCount: number;
  if (cat.topScore >= 50) visibleCount = 5;
  else if (cat.topScore >= 30) visibleCount = 3;
  else visibleCount = Math.min(2, items.length);
  return {
    key: cat.key,
    visible: items.slice(0, visibleCount),
    hidden: items.slice(visibleCount),
    allItems: items,                  // SAME reference — no re-sort, no copy
    topScore: cat.topScore,
  };
});
```

### 2. Treat `allItems` / `cat.items` as immutable (Codex)

The whole correctness story depends on `allItems` being the same array `rankCategories` produced.

- Audit consumers for any `.sort()`, `.reverse()`, `.push()`, `.splice()`, or index assignment against `cat.items`, `cat.visible`, `cat.hidden`, or `cat.allItems`.
- If any are found, replace with non-mutating equivalents (`[...arr].sort(...)`, etc.).
- Add a JSDoc note on `CollapsedCategory.allItems`: _“Same reference as the ranked source; treat as read-only.”_

### 3. Use canonical category keys everywhere

Standardize on the keys the ranking pipeline emits:
`entities`, `books`, `movies`, `places`, `users`, `hashtags`.

In `Search.tsx`, drop the `'localResults'` remap. Use `entities` directly so toggle state lookups can't drift between the two pages.

Sanity grep before coding: confirm no consumer is doing `[...cat.visible, ...cat.hidden]`. After this change, **everything reads `cat.allItems`** when expanded.

### 4. Render from expand state using `allItems`, with empty guard

For each ranked category on both pages:

```ts
if (!cat.allItems?.length) return null;          // empty render guard
const isExpanded = !!showAllResults[cat.key];
const itemsToRender = isExpanded ? cat.allItems : cat.visible;
```

Apply consistently to entities, users, hashtags, and external (books/movies/places) render branches.

### 5. Toggle visibility uses the pipeline's own collapse decision

```ts
const canToggle = cat.hidden.length > 0;
```

Not a hardcoded `> 3` threshold. `softCollapse` already chose 5/3/2 based on score; the header just respects that.

Label: `See Less` when expanded, `See More` when collapsed.

### 6. Form-safe, focus-safe toggle button

In `Search.tsx` (and same shape on Explore for parity):

```tsx
<Button
  type="button"                                  // never submit
  variant="ghost"
  size="sm"
  className="h-6 px-2 text-xs text-brand-orange ..."
  onMouseDown={(e) => e.preventDefault()}        // keep input focus
  onClick={(e) => {
    e.stopPropagation();                         // don't bubble to form/blur
    handleToggle(cat.key, cat.hidden.length);
  }}
>
  {isExpanded ? <>See Less <ChevronUp .../></> : <>See More <ChevronDown .../></>}
</Button>
```

### 7. Toggle handler: guard, then functional updates

```ts
const handleToggle = (key: string, hiddenCount: number) => {
  if (hiddenCount === 0) return;                              // defensive guard
  setShowAllResults(prev => ({ ...prev, [key]: !prev[key] })); // functional
  setHighlightedIdx(() => -1);                                // Search only — clamp aria
};
```

### 8. Reset state on query change AND route change

Both pages:

```ts
const initialExpansion = {
  entities: false, books: false, movies: false,
  places: false, users: false, hashtags: false,
};

useEffect(() => {
  setShowAllResults(initialExpansion);
  setHighlightedIdx(-1);              // ChatGPT: also reset highlight on new query
}, [trimmedQuery]);

useEffect(() => {
  setShowAllResults(initialExpansion);
}, [location.pathname]);
```

Resetting `highlightedIdx` on query change prevents stale `aria-activedescendant` and broken Enter behavior when results change underneath the highlight.

### 9. Stable React keys (no array index alone)

Audit every row render and confirm the `key` is a stable identity, never just the loop index:

- entities: `key={entity.id}`
- users: `key={user.id}`
- hashtags: `key={hashtag.id}`
- external: `key={`${result.api_source}-${result.api_ref ?? index}`}` (id-first, index only as fallback)

Guarantees the first 5 DOM nodes are reused when the list grows from 5 → 20 — no flicker, no lost hover/focus.

### 10. Reopen Search dropdown when input is re-clicked while still focused

Add `onMouseDown` on the Search input that clears `isDropdownDismissed` when the input already has focus and there is a query or recents to show. Escape-to-dismiss is preserved.

### 11. Keep “Show N more in full search” footer separate

The footer remains its own row that navigates to the full Search page. It is not the inline toggle. Both can coexist:
- inline orange toggle = expand/collapse within dropdown
- footer link = jump to full results page

---

## Files changed

- `src/utils/searchRanking.ts` — additive `allItems` on `CollapsedCategory`; populate from same ranked array reference; immutability JSDoc.
- `src/pages/Explore.tsx` — pass canonical `cat.key` to `renderSectionHeader`; render from `allItems` when expanded; empty-category guard; reset state on query + route change; `type="button"` + `stopPropagation` + `hiddenCount === 0` guard; verify stable keys.
- `src/pages/Search.tsx` — same as Explore plus: drop `'localResults'` remap, clamp `highlightedIdx` on toggle and on query change via functional updater, restore re-click reopen.

No changes to `EnhancedSearchInput.tsx` or `SearchDialog.tsx`.

---

## Acceptance checks

1. Explore dropdown shows the orange “See More / See Less” when a category has hidden items.
2. Search dropdown shows the same toggle, in the same position, with the same styling.
3. Clicking “See More” on Search does not close the dropdown and does not submit the form.
4. Clicking “See More” actually expands to the full ranked list (not just label change).
5. Clicking “See Less” collapses back to the preview count.
6. Expanded list order is identical to collapsed preview order for the first N rows (no re-sort drift).
7. First 5 rows do not flicker / lose focus when expanding from 5 → 20.
8. Toggle does nothing and label does not flip when `hidden.length === 0`.
9. Empty category never renders a stray header + toggle.
10. Typing a new query resets all sections to collapsed AND resets the keyboard highlight.
11. Navigating between `/explore` and `/search` resets expansion state.
12. Arrow-key navigation never points `aria-activedescendant` at a missing row after toggling or after a new query.
13. After dismissing the Search dropdown, clicking back into the still-focused input reopens it.
14. “Show N more in full search” footer still works and is visually distinct from the inline toggle.
15. Ranked ordering, “Already on Groundz”, IME guard, hover prefetch, and external-result processing all continue to work.
16. `EnhancedSearchInput.tsx` and `SearchDialog.tsx` behavior is unchanged.
17. No code path mutates `cat.items` / `cat.visible` / `cat.hidden` / `cat.allItems` in place.
18. No code path reconstructs the expanded list as `[...cat.visible, ...cat.hidden]` — everything uses `cat.allItems`.
19. Project still type-checks — no other consumer of `CollapsedCategory` / `softCollapse` is broken by the additive `allItems` field.
