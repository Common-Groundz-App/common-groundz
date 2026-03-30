

# Fix Bold/Weight Issues on Profile Stats

## 2 files, 2 fixes

### 1. PublicProfileView.tsx — only number bold, not label
**Lines 101-108:** Replace current code so only the count is wrapped in `<strong>`, label stays normal weight:

```jsx
<div className="flex gap-4 text-sm">
  <span className="text-muted-foreground">
    <strong className="text-foreground">{followerCount}</strong> {followerCount === 1 ? 'follower' : 'followers'}
  </span>
  <span className="text-muted-foreground">
    <strong className="text-foreground">{followingCount}</strong> following
  </span>
</div>
```

Manual label derivation is acceptable here because styling requires splitting number from label. `formatCount` remains the default everywhere else.

### 2. ProfileInfo.tsx — remove font-medium from stats
Remove `font-medium` from both the "following" `<span>` and the "followers" `<div>` so their weight matches the rest of the profile card (location, joined date).

```jsx
<div className="flex items-center gap-3 text-sm">
  <div 
    className="flex items-center text-gray-600 cursor-pointer hover:text-gray-800 transition-colors"
    onClick={handleShowFollowing}
  >
    <Users size={16} className="mr-1.5 text-gray-500" />
    <span>{followingCount} following</span>
  </div>
  <div 
    className="text-gray-600 cursor-pointer hover:text-gray-800 transition-colors"
    onClick={handleShowFollowers}
  >
    {formatCount(followerCount, 'follower')}
  </div>
</div>
```

### Not touched
- EntityHeader, CategoryHighlights — already fixed in previous implementation
- No other files modified

