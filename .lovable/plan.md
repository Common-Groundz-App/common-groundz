

# Refinements for Circle Recommendation Cards

## Changes — single file: `src/components/entity/RecommendationEntityCard.tsx`

### 1. Replace manual Avatar with ProfileAvatar
Replace the `Avatar > AvatarImage > AvatarFallback` block (lines 146-160) with `ProfileAvatar` component using `recommendedByUserId`. This gives brand-orange background with white initials for users without avatars — matching Circle Rating avatars throughout the app.

Normalize `recommendedByUserId` (can be `string | string[]`) into an array. Use `ProfileAvatar` with `size="xs"` and className `"h-4 w-4 ring-1 ring-background"`.

### 2. Two-line attribution layout
Split the attribution back to two lines (lines 169-174) so the timestamp isn't clipped:
- **Line 1**: Avatars + `{name} & {name} recommended this` (past tense)
- **Line 2**: `· {shortTimeAgo}` as separate small muted text below

### 3. Update `formatRecommendedBy` (lines 62-69)
- Change "recommends/recommend" → "recommended" (past tense)
- Add fallback: if no valid users, return `"Recommended by your circle"`

### 4. +N badge brand styling (line 162)
Change `bg-muted` → `bg-brand-orange/20 text-brand-orange` to match ProfileAvatar brand style.

### 5. Keep truncation + 2-avatar cap
Already in place — no changes needed.

