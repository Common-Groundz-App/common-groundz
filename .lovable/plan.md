

# Consistency Fixes: Casing, Bold Weight, and Review Labels

ChatGPT's refinement is valid — we should not bypass `formatCount` with manual ternaries. The cleanest solution: use `formatCount` for the full string and wrap the entire output in bold, rather than splitting count and label.

## Changes (4 files)

### 1. EntityHeader.tsx — lowercase "recommending"
- Line 529: `Recommending` → `recommending`
- Line 557: `Recommending` → `recommending`

### 2. ProfileInfo.tsx — lowercase "following" + bold both
Current (lines 53-68):
- `{followingCount} Following` with `font-medium` on count only
- `{formatCount(followerCount, 'follower')}` with no bold

Fix:
- Change `Following` → `following`
- Wrap both stats in `font-medium` consistently:

```jsx
<div className="flex items-center gap-3 text-sm">
  <div 
    className="flex items-center text-gray-600 cursor-pointer hover:text-gray-800 transition-colors"
    onClick={handleShowFollowing}
  >
    <Users size={16} className="mr-1.5 text-gray-500" />
    <span className="font-medium">{followingCount} following</span>
  </div>
  <div 
    className="font-medium text-gray-600 cursor-pointer hover:text-gray-800 transition-colors"
    onClick={handleShowFollowers}
  >
    {formatCount(followerCount, 'follower')}
  </div>
</div>
```

### 3. PublicProfileView.tsx — lowercase "following" + bold both
Current (lines 101-108): follower count not bold, following count uses `<strong>`.

Fix — use `<strong>` on both, use `formatCount` for follower (no manual ternary):

```jsx
<div className="flex gap-4 text-sm">
  <span className="text-muted-foreground">
    <strong className="text-foreground">{formatCount(followerCount, 'follower')}</strong>
  </span>
  <span className="text-muted-foreground">
    <strong className="text-foreground">{followingCount}</strong> following
  </span>
</div>
```

This keeps `formatCount` as the single source of truth — no manual plural logic anywhere.

### 4. CategoryHighlights.tsx — "(6)" → "(6 reviews)"
- Import `formatCount` from `@/lib/utils`
- Replace all `({entity.reviewCount})` with `({formatCount(entity.reviewCount, 'review')})` (3 locations: lines ~144, ~205, ~300)

### Not touched
- ContributorModal, PostDetailSidebar, EntityV3Header — no changes
- "recommending" stays as a verb everywhere

