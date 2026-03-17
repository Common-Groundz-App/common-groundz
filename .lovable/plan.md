

# Recommendation Card Attribution — Final Refinements

## Agreement with ChatGPT's feedback

Yes, the flex-based alignment approach is better than hardcoded `ml-7`. The current code (lines 140-177) already has avatars and text in a flex row, but the timestamp sits outside that row. The fix is to restructure so the timestamp nests under the text, not under the whole block.

## Changes — `src/components/entity/RecommendationEntityCard.tsx`

### 1. Restructure attribution layout (lines 140-177)
Replace `space-y-0.5` wrapper with a `flex items-start gap-1` layout where avatars are one flex child and a `div` containing both the attribution text and timestamp is the other. This auto-aligns the timestamp under the text without magic margins.

```text
Before:
┌─────────────────────────────┐
│ [👤👤] name & name rec...   │  ← flex row
│ · 9mo ago                   │  ← separate element with ml-0.5
└─────────────────────────────┘

After:
┌─────────────────────────────┐
│ [👤👤]  name & name         │  ← flex row
│          recommended this   │
│          · 9mo ago          │  ← nested under text div
└─────────────────────────────┘
```

### 2. Change `line-clamp-1` → `line-clamp-2` (line 168)
Allow the attribution sentence to wrap to a second line so the full meaning is preserved.

### 3. Smarter name truncation in `formatRecommendedBy`
When 2+ users, reduce truncation max from 12 → 10 chars to give more room for the sentence.

### Summary
Three small changes, all in one file. No hardcoded margins, future-proof layout, full sentence preserved.

