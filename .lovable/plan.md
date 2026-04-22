

## Verdict: Adopt all 5 (ChatGPT's 1 + Codex's 4). All are small, defensive, and prevent real bugs.

---

## What changes from the previous plan

### Added — ChatGPT's prefetch debounce

Hover sweeps or held arrow keys can spam `prefetchEntity` calls. Debounce 80ms:

```ts
const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
const lastPrefetchedSlugRef = useRef<string | null>(null);

const handlePrefetch = (slug?: string) => {
  if (!slug || slug === lastPrefetchedSlugRef.current) return;
  if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
  prefetchTimerRef.current = setTimeout(() => {
    prefetchEntity(slug);
    lastPrefetchedSlugRef.current = slug;
  }, 80);
};
```

Used in both `onMouseEnter` and keyboard-highlight effect. Cleared on dropdown close.

### Corrected — Codex #1: `isDropdownDismissed` reset paths

Previous plan only reset on next blur + onChange. Add **reset on next focus** too, so the flag never gets "stuck closed" across focus cycles:

```ts
onFocus: () => {
  setIsFocused(true);
  setIsDropdownDismissed(false);  // ← added
}
onChange: (e) => {
  setIsDropdownDismissed(false);  // already planned
  // ... existing handler
}
onBlur: () => {
  setTimeout(() => {
    setIsFocused(false);
    setIsDropdownDismissed(false);  // already planned
  }, 150);
}
```

Three reset paths guarantee the flag is purely a single-Escape-press dismissal, never persistent state.

### Corrected — Codex #2: Safe stale-entity removal with guard

Previous plan assumed `fallbackEntityId` would always be present. Legacy nav state (from before this change rolled out) won't have it. Guard:

```ts
useEffect(() => {
  if (!entityNotFound) return;
  const { fallbackQuery, fallbackEntityId } = location.state ?? {};
  if (!fallbackQuery) return;  // not from a recent-pick — bail
  if (fallbackEntityId) {
    removeRecentByEntityId(fallbackEntityId);  // surgical, safe
  }
  // If fallbackEntityId missing: redirect only, do NOT touch recents
  // (text-based removal could nuke a same-named query recent — unsafe)
  navigate(`/search?q=${encodeURIComponent(fallbackQuery)}`, { replace: true });
}, [entityNotFound, location.state]);
```

Non-destructive fallback for legacy state. Worst case: one stale entity recent stays until the user manually × removes it or 30-day TTL evicts it.

### Corrected — Codex #3: Prefetch only-when-changed guard

Already covered by `lastPrefetchedSlugRef` in the debounce snippet above — same slug won't refetch. Confirms intent.

### Added — Codex #4: ARIA `aria-activedescendant` for full combobox compliance

Previous plan had `role="combobox"`, `role="listbox"`, `role="option"`, `aria-selected`. Missing piece: screen readers also need `aria-activedescendant` on the input pointing to the currently-highlighted option's `id` so they announce the highlighted item without focus actually moving:

```tsx
// Each option gets a stable id:
<div role="option" id={`search-opt-${idx}`} aria-selected={highlightedIdx === idx}>

// Input wires it:
<Input
  role="combobox"
  aria-expanded={shouldShowDropdown}
  aria-controls="search-dropdown"
  aria-activedescendant={
    shouldShowDropdown && highlightedIdx >= 0
      ? `search-opt-${highlightedIdx}`
      : undefined
  }
/>
```

Standard ARIA 1.2 combobox pattern. Zero visual change.

### Carried unchanged from previous turn

- ✅ Render-guard, focus-only opening, `onBlur` 150ms grace
- ✅ Restore inline "See More" with `max-h-[300px] overflow-y-auto`
- ✅ Keep "Show N more in full search" link AND top-right "Search More" button
- ✅ Entity recents store `entityId`, `entityType`, `slug`
- ✅ Cross-kind dedup (entity wins), normalized dedupe via shared `normalize`
- ✅ 30-day TTL cleanup on mount
- ✅ Visible cap 6 (storage cap stays 8)
- ✅ Shared `'explore'` recents bucket across `/explore` + `/search`
- ✅ Composer (`'composer'` bucket) untouched, back-compat preserved
- ✅ Animation: `animate-in fade-in-0 slide-in-from-top-1 duration-150`
- ✅ ↑/↓ keyboard nav across merged list, Enter activates, Escape closes (no blur)
- ✅ Hover/highlight prefetch via `useEntityCache().prefetchEntity`
- ✅ NotFound redirect with `fallbackQuery` state

---

## Files to change (final)

| File | Change |
|------|--------|
| `src/hooks/useRecentSearches.ts` | Extend `RecentSearchItem` with `kind` + entity metadata; cross-kind dedup (entity wins); shared `normalize`; 30-day TTL filter on mount; add `removeRecentByEntityId(id)` |
| `src/components/search/RecentSearchesPanel.tsx` | New shape; clock icon for query, bookmark icon for entity; visible cap 6; `role="listbox"` + `role="option"` with stable `id` + `aria-selected`; pass full item to `onPick`; `onMouseEnter` debounced prefetch hook for entity items |
| `src/pages/Explore.tsx` | (a) `isFocused` + `isDropdownDismissed` state with **3 reset paths** (focus, change, blur); (b) `shouldShowDropdown = isFocused && !isDropdownDismissed && (query \|\| recents)`; (c) Escape closes via dismissed flag, **does NOT blur**; (d) ↑/↓ keyboard nav across merged list; (e) **debounced prefetch (80ms) + last-slug guard** on hover and keyboard highlight; (f) ARIA: `role="combobox"`, `aria-expanded`, `aria-controls`, **`aria-activedescendant`**; (g) restore inline expansion with `max-h-[300px] overflow-y-auto`; (h) keep both "Show N more" link and "Search More" button; (i) `addRecent(entity.name, 'entity', { entityId, entityType, slug })` on click; (j) `addRecent(searchQuery, 'query')` on Enter; (k) `onPickRecent`: entity → `navigate(slug, { state: { fallbackQuery, fallbackEntityId } })`, query → fill input + run search; (l) animation classes |
| `src/pages/Search.tsx` (or whatever powers `/search`) | Identical pattern: same bucket, same gating, same Escape rule, same keyboard rules, same animation, same fallback state, same debounced prefetch, same ARIA |
| Entity page component (NotFound branch) | Guarded redirect: only `removeRecentByEntityId` when `fallbackEntityId` present; otherwise redirect-only (non-destructive) |

---

## Explicitly NOT touching

- ❌ `UnifiedEntitySelector.tsx` (composer) — bucket and behavior unchanged; back-compat default keeps it identical
- ❌ `searchRanking.ts` — pipeline unchanged (just consumed for `normalize`)
- ❌ `use-enhanced-realtime-search.ts` — `toggleShowAll` already exists, just rewiring JSX
- ❌ Edge functions, debounces (search-side), abort logic, cache layer, image proxy
- ❌ "Show N more in full search" link — kept
- ❌ Storage cap 8; only **visible** cap is 6
- ❌ No new dependencies, no DB, no env vars
- ❌ No analytics, no behavioral ranking (good next step, not now)
- ❌ Text-based stale-recent removal (rejected as unsafe)

---

## Verification

1. Visit `/explore` fresh with existing recents → no dropdown (focus required)
2. Click input with empty recents → no dropdown (render-guard)
3. Click input with recents → fades in 150ms, max 6 items
4. Press Escape → closes, focus stays, can keep typing
5. Type after Escape → reopens (dismissed flag reset on change)
6. Press Escape, click outside, click back in → reopens (dismissed flag reset on focus)
7. Click outside → fades out (150ms grace)
8. ↓/↑ navigate merged list; Enter activates highlighted
9. Hover entity recent rapidly → only one prefetch fires after 80ms idle
10. Hold ↓ key → prefetch only fires when slug actually changes (not per keypress on same item)
11. Hover entity recent → entity data in TanStack cache → click feels instant
12. Type "mal" → click "See More" on Books → expands inline, capped 300px, scrollable
13. "Show N more in full search" + "Search More" both present
14. Click "Mallika Biryani" → entity → return → focus → recent shows entity name with bookmark
15. If entity later deleted: clicking recent → NotFound → auto-redirects to `/search?q=...` → entity recent removed by ID (same-text query recent stays intact)
16. Legacy nav state without `fallbackEntityId`: redirect happens, no recent removed (safe)
17. Type "mallika biryani" → Enter → return → only entity version shown (entity wins dedup)
18. Type "ramen" → Enter → return → recent with clock icon; click → fills input + searches
19. `/search` page → identical behavior, shares recents
20. Recent older than 30 days → silently removed on next visit
21. "Mallika!" + "mallika" → one entry (normalized)
22. Legacy entity recent without `slug` → treated as query
23. × on recent → row removed, panel stays open
24. "Clear all" → cleared, panel hides
25. Screen reader: combobox state announced, highlighted option announced via `aria-activedescendant`, listbox/option roles correct
26. Composer recents behavior unchanged
27. Private mode / quota → silent no-op
28. All previous turns' fixes intact

