

## Verdict: Adopt both of ChatGPT's additions. They're tiny and prevent real bugs.

Both are defensive hygiene — shared normalizer prevents "works in scoring, fails in dedupe" drift; Levenshtein length guard prevents wasted CPU on edge cases. Folding in.

---

## What changes from the previous plan

### Added (2 small hardenings)

**1. Single shared `normalize()` used everywhere in `searchRanking.ts`**

```ts
export const normalize = (str: string): string =>
  (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
```

Used by **every** ranking function — `scoreResult`, `dedupeResults` (for the dedupe key), `isNearMatch`, `shouldOverride`, `applyExactMatchOverride`. No local re-implementations. Prevents the classic "exact match doesn't fire because dedupe stripped a comma but scoring didn't" bug.

Note: `UnifiedEntitySelector.tsx` already has its own local `normalize` (line 47). I'll **delete that local copy** and have it import the shared one from `searchRanking.ts` so the entire file uses one definition. No behavior change there — its current normalize is a subset (lowercase + collapse spaces, no punctuation strip), and upgrading it to also strip punctuation is strictly an improvement for the "Did you mean?" similarity check.

**2. Skip Levenshtein for very long strings (>40 chars)**

```ts
function isNearMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length > 40 || nb.length > 40) return false;  // skip — long names don't need typo correction
  return levenshtein(na, nb) <= levenshteinThreshold(nb);
}
```

Prevents wasted CPU on full book/movie titles ("The Curious Incident of the Dog in the Night-Time"). Long names already match well via substring scoring; Levenshtein adds nothing useful at that length.

### Unchanged from previous plan

- ✅ Adaptive Levenshtein threshold (1 / 2 / 3 by query length)
- ✅ Confidence-gated override (exact: always; near: only if score ≥ 60)
- ✅ Cross-category visual deduplication
- ✅ Soft-collapse (strong: 5, medium: 3, weak: 1–2)
- ✅ Top row gets `font-medium` + faint divider, no chip/badge/label
- ✅ `useRecentSearches` + `RecentSearchesPanel` with × per row + "Clear all"
- ✅ localStorage cache (`cg_search_cache_v1`, 60s TTL, 50 entries)
- ✅ Keyboard nav (↑/↓/Enter), per-category shimmer, last-picked-category icon hint

---

## Files (final)

| File | Change |
|------|--------|
| `src/utils/searchRanking.ts` | **NEW** — exports shared `normalize`, `levenshtein` (with >40 char skip), `levenshteinThreshold`, `isNearMatch`, `shouldOverride`, `scoreResult`, `dedupeResults`, `rankCategories`, `applyExactMatchOverride`, `softCollapse`. JSDoc spec block for canonical queries. |
| `src/hooks/useRecentSearches.ts` | **NEW** — surface-scoped recent-searches hook |
| `src/components/search/RecentSearchesPanel.tsx` | **NEW** — reusable history UI with × per row |
| `src/components/feed/UnifiedEntitySelector.tsx` | Apply pipeline, mount panel, keyboard nav, top-row weight; **delete local `normalize` (line 47), import from `searchRanking.ts`** |
| `src/pages/Explore.tsx` | Same pipeline + panel in dropdown |
| `src/hooks/use-enhanced-realtime-search.ts` | localStorage layer behind existing cache helpers |

No edge function changes. No DB. No new env vars. No new deps.

---

## Final pipeline

```text
raw results from edge function
        │
        ▼
dedupeResults()
  key = normalize(name) + '|' + normalize(venue)
        │
        ▼
scoreResult()  (uses shared normalize)
        │
        ▼
sort within each category by score
        │
        ▼
sort categories by top-result score
        │
        ▼
applyExactMatchOverride()
  shouldOverride() gate:
    normalize(a) === normalize(b)                            → always
    isNearMatch(a, b) && score >= 60                          → conditional
  isNearMatch:
    skip if either string > 40 chars
    threshold: ≤4 → 1 | ≤8 → 2 | >8 → 3
        │
        ▼
softCollapse()
  strong (top ≥ 50): 5 visible
  medium (30–49):    3 visible
  weak (<30):        1–2 visible
  rest behind "Show N more"
        │
        ▼
render
  row[0][0]: font-medium + faint divider
  no chip, no badge, no label
```

---

## Explicitly NOT touching (carried forward)

- ❌ No edge function changes
- ❌ No changes to debounces, abort logic, MIN_EXTERNAL_QUERY_LENGTH, image proxy, fallbacks
- ❌ No changes to entity selection, location, mentions, hashtags, post submission
- ❌ No `★ Best match` chip — anywhere
- ❌ No DB tables, RLS, migrations
- ❌ No test suite (spec captured in JSDoc)
- ❌ No analytics events
- ❌ No personalized/circle-based ranking
- ❌ No new third-party libs

---

## Verification

1. `/create` → "malika biryani" → Mallika Biryani is row 0 of category 0 (near-match + score ≥ 60)
2. `/create` → "Mallika, Biryani!" (with punctuation) → still triggers override (shared normalize strips it)
3. `/create` → "malika briyani" (transposed) → still triggers override
4. `/create` → "ram" → does NOT pull in "cream"/"ramen" (threshold = 1, score gate)
5. `/create` → "The Curious Incident of the Dog in the Night-Time" → no Levenshtein run (>40 chars), substring scoring still works
6. `/create` → "inception" → Movies first; if exact title exists, row 0
7. Categories with weak matches show 1–2 items + "Show N more"
8. Strong categories show up to 5 inline
9. Dedup: same place from Places + Food APIs → one entry only
10. `/create` → empty focused input → Recent searches with × per row + "Clear all"
11. × removes a single recent without closing dropdown
12. Same on `/explore`
13. Reload → cached query returns instantly within 60s, no edge call
14. ↓/↓/Enter → highlights and selects correctly
15. Private mode → recent + cache silently no-op
16. localStorage quota exceeded → caught silently
17. No chip, no "Best match" text anywhere
18. Top-row visual weight is subtle, not loud
19. `UnifiedEntitySelector`'s "Did you mean?" check still works (now using shared normalize, slightly improved)
20. All previous turns' fixes intact

