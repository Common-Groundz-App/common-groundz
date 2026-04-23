

# Make Search dropdown identical to Explore dropdown — final

The two search boxes drifted apart. We'll align Search with Explore as the reference, fixing all observed bugs (slowness, missing "Already on Groundz", See More closing dropdown) and bringing UX to parity, with full guards for IME users, race conditions, and timer leaks.

---

## Confirmed root causes

1. **Slowness** — Search.tsx runs **two** `useEnhancedRealtimeSearch` calls per keystroke. Doubles backend traffic.
2. **Missing "Already on Groundz" for typo'd queries** — Search dropdown skips the ranking pipeline (`dedupeResults` → `rankCategories` → `applyExactMatchOverride` → `softCollapse`) that Explore runs.
3. **See More / See Less closes dropdown** — Toggle buttons don't `preventDefault` on `mousedown`, so clicking blurs the input → 150ms timer → unmount.
4. **External item clicks misbehave** — Search wraps `SearchResultHandler` in an outer `<div onClick={...}>` that intercepts the click and just refills the input.
5. **Other drift** — 2-char threshold (vs 1), no hashtags, no "Show N more in full search" link, no hover-prefetch, redundant `handleClickOutside`, different loading text, double Add Entity CTA.

---

## The fix — apply Explore's pattern to Search

### A. Single search hook
Remove the dropdown's separate `useEnhancedRealtimeSearch(searchQuery, ...)` call. Drive both page and dropdown from one hook keyed off `searchQuery`. **Do not delete the hook itself** — Explore and other consumers use it. We only stop the duplicate *call*.

### B. Keep URL ↔ input in sync (Codex earlier guardrail)
- On mount and on `searchParams` change → `setSearchQuery(searchParams.get('q') || '')`. Handles initial load, back/forward, pasted links.
- Form submit and dropdown selection continue to call `setSearchParams({ q, mode: 'quick' })`.
- Clearing the input does **not** wipe `?q=` — only explicit submit/selection updates URL (current behavior preserved).

### C. Apply ranking pipeline to dropdown, gated on trimmed query (ChatGPT guardrail)
```ts
const trimmedQuery = searchQuery.trim();
const collapsed = useMemo(() => {
  if (trimmedQuery.length < 1) return null;          // prevent stale flicker
  // dedupeResults → rankCategories → applyExactMatchOverride → softCollapse
}, [results, trimmedQuery]);
```
Render the dropdown body only when `collapsed` is non-null.

### D. Fix See More / See Less closing dropdown
1. Add `onMouseDown={(e) => e.preventDefault()}` to every "See More / See Less" `<Button>` so the input never loses focus.
2. **Reset show-all state when query changes**, but only outside IME composition:
   ```ts
   useEffect(() => {
     if (isComposingRef.current) return;
     setDropdownShowAll({ localResults: false, books: false, movies: false, places: false });
   }, [trimmedQuery]);
   ```

### E. Fix external-item click behavior
Remove the outer `<div onClick={handleDropdownItemClick}>` wrapper. Wire `SearchResultHandler` exactly like Explore: `onClose`, `onProcessingStart`, `onProcessingUpdate`, `onProcessingEnd`, `useExternalOverlay={true}`. Mirror Explore's page-level `isProcessingEntity` / `processingEntityName` / `processingMessage` state and the full-screen overlay component.

### F. Dismiss dropdown during entity processing (ChatGPT guardrail)
```ts
onProcessingStart={(name, msg) => {
  setIsDropdownDismissed(true);
  setIsFocused(false);
  setIsProcessingEntity(true);
  setProcessingEntityName(name);
  setProcessingMessage(msg);
}}
```

### G. Lower threshold to 1 character
Change `>= 2` → `>= 1` in both `shouldShowDropdown` and `showRecentsBranch`.

### H. Add the missing pieces
- **Hashtags section** — copy Explore's block; click navigates to `/t/<name_norm>`.
- **"Show N more in full search"** footer per external category when `cat.hidden.length > 0`.
- **Add Entity CTA** — once at the bottom when `searchQuery.length >= 1` (consolidate the current two copies).
- **Loading text**: "Searching with enhanced reliability…".
- **Hover prefetch** on entity rows via existing `schedulePrefetch` on `onMouseEnter`.

### I. Drop redundant click-outside handler
Remove the `handleClickOutside` effect. The 150ms blur grace timer matches Explore and avoids race conditions with internal clicks.

### J. Preserve keyboard / ARIA parity (Codex earlier guardrail)
- Stable `aria-activedescendant` ids (`search-opt-${idx}`).
- `flatKeyboardItems` index aligned with rendered DOM order: recents → entities → places → books → movies → hashtags. Footer/CTA rows excluded from nav.
- Preserve `Escape` (dismiss without blur), `ArrowUp`/`ArrowDown` (wrap), `Enter` (activate highlighted or submit).
- `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `role="combobox"` on input; `role="listbox"` / `role="option"` on dropdown.

### K. IME composition guard (Codex final)
Add a composition ref and short-circuit keyboard handling while composing:
```ts
const isComposingRef = useRef(false);

<Input
  onCompositionStart={() => { isComposingRef.current = true; }}
  onCompositionEnd={() => { isComposingRef.current = false; }}
  onKeyDown={(e) => {
    if (isComposingRef.current || e.nativeEvent.isComposing) return; // skip nav during IME
    handleInputKeyDown(e);
  }}
/>
```
Applies to Enter, ArrowUp, ArrowDown, Escape — and the show-all reset effect (section D2).

### L. Cleanup pending timers (Codex final + my addition)
Clean up in three places, not just unmount:
```ts
// On unmount
useEffect(() => () => {
  if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
  if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
}, []);

// When dropdown closes — cancel queued prefetch so it doesn't fire after navigation
useEffect(() => {
  if (!shouldShowDropdown && prefetchTimerRef.current) {
    clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = null;
  }
}, [shouldShowDropdown]);

// When query changes — reset last-prefetched slug so same-named entity in new results re-prefetches
useEffect(() => {
  lastPrefetchedSlugRef.current = null;
}, [trimmedQuery]);
```

### M. Visual parity
Replace `p-2` wrapper + `rounded p-2` rows with Explore's `border-b last:border-b-0 bg-background` section structure. Reuse the same `renderSectionHeader` helper signature.

---

## Files changed

- **`src/pages/Search.tsx`** — all of the above. Single file.

Untouched:
- `src/hooks/use-enhanced-realtime-search.ts` (still used by Explore + others — only stop calling twice)
- `src/hooks/useRecentSearches.ts`
- `src/components/search/RecentSearchesPanel.tsx`
- `src/pages/Explore.tsx` (reference)
- `src/pages/EntityDetail.tsx` / `EntityDetailV2.tsx`

---

## Acceptance checks

1. "malika briyani" on Search → "✨ Already on Groundz" appears, same ordering as Explore.
2. DevTools Network shows **one** request per keystroke debounce (not two).
3. "See More" / "See Less" → dropdown stays open; expands/collapses smoothly.
4. Type → click "See More" → type more → show-all resets to default.
5. Click book/movie/place → entity materializes via overlay → navigates (parity with Explore).
6. During processing, dropdown is closed; no overlay/dropdown overlap.
7. URL `?q=foo` direct-load hydrates input + searches; back/forward stays in sync; clearing input keeps URL until submit.
8. Recents shared with Explore (same items/icons; hover-prefetch works).
9. Hashtags appear; click → `/t/<name>`.
10. Single character "m" opens dropdown.
11. Escape dismisses without blur; arrows highlight rows; `aria-activedescendant` updates; Enter activates highlighted or submits.
12. Add Entity CTA appears once when query ≥ 1 char.
13. **IME**: Typing Japanese/Korean/Chinese/Indic via IME — Enter/Arrow during composition does NOT trigger nav or submit; show-all not reset mid-composition.
14. **Timer cleanup**: navigate away mid-debounce → no React "unmounted component" warnings; no late prefetch firing.
15. **Stale-slug guard**: type "mal" → hover "Mallika" (prefetch) → clear & type "ram" → hover "Ramen" (different entity, same-named slug edge case) → prefetch fires.
16. **No stale flicker**: type fast — dropdown never shows results from a previous query.
17. No regressions on Explore page or other consumers of `useEnhancedRealtimeSearch`.

