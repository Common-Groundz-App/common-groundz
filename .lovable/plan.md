

# Circle Recommendations UI Polish

Both ChatGPT and Codex agree — the plan is ready. Their additions (clean truncation, blank username fallback) are minor but worth including.

## Changes

### 1. Branding — 3 files
Update "Recommended by Your Network" → **"Recommended by Your Circle"** in:
- `src/components/entity-v4/NetworkRecommendations.tsx` (line 225)
- `src/components/modals/RecommendationsModal.tsx` (line 37)
- `src/components/entity-v4/ReviewsSection.tsx` (line 565)

### 2. Avatar alignment fix — `src/services/networkRecommendationService.ts`
Line 261: Remove `.filter(Boolean)` so avatar array stays index-aligned with usernames:
```typescript
displayAvatars: anyRec.recommender_avatars || []
```

### 3. Card polish — `src/components/entity/RecommendationEntityCard.tsx`

**a) Smarter `formatRecommendedBy` (lines 57-66)**

Add a `truncateName` helper (max 12 chars, clean ellipsis). Update logic:
- 0 users: empty string (guard)
- 1 user: `{name} recommends this`
- 2 users: `{name} & {name} recommend this`
- 3+: `{name} & {N-1} others recommend this`

Filter out blank/falsy usernames before formatting.

**b) Cap avatars at 2, update +N badge (lines 148-172)**
- `.slice(0, 2)` instead of `.slice(0, 3)`
- `+N` threshold: `> 2` instead of `> 3`
- Null avatar URLs already handled by `AvatarFallback` showing initials

**c) Inline time-ago (lines 174-182)**
Remove the separate `<p>` block for time-ago. Instead, append ` · {shortTimeAgo}` to the attribution text line. Shorten time labels (e.g. "9mo ago", "2d ago", "3w ago") for compact display.

## Summary
4 files touched. Pure UI/branding polish — no backend or SQL changes.

