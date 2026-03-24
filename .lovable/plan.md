

# Feed Card Polish

## Changes

### 1. Fix hover behavior — `PostFeedItem.tsx`

**Line 375**: Remove `className="hover:underline"` from UsernameLink. The component already has independent hover:underline on display name and @handle internally. The outer class is redundant and can cause the wrapper div itself to underline.

```tsx
// Before
className="hover:underline"
// After
(remove className prop entirely, or leave empty)
```

### 2. Remove "Public" visibility badge — `PostFeedItem.tsx`

**Lines 377-384**: Remove the visibility indicator row (Globe icon + "Public" label) for public posts. Everything visible in the feed is public — showing it is noise. Keep the icon only for non-public posts (private/circle_only) as a meaningful signal.

```tsx
// Before: always shows visibility
<div className="flex items-center text-muted-foreground text-xs gap-1">
  <span>{format(...)}</span>
  <span>·</span>
  <div className="flex items-center gap-1">
    {getVisibilityIcon()}
    <span>{getVisibilityLabel()}</span>
  </div>
</div>

// After: only show visibility for non-public
<div className="flex items-center text-muted-foreground text-xs gap-1">
  <span>{format(...)}</span>
  {post.visibility !== 'public' && (
    <>
      <span>·</span>
      <div className="flex items-center gap-1">
        {getVisibilityIcon()}
        <span>{getVisibilityLabel()}</span>
      </div>
    </>
  )}
</div>
```

### 3. Use `formatDateLong` utility — `PostFeedItem.tsx`

**Line 378**: Replace inline `format(new Date(post.created_at), 'MMM d, yyyy')` with the shared `formatDateLong` utility we just created, for consistency across the app.

### 4. Clean up unused date function — `PostFeedItem.tsx`

**Lines 238-252**: The local `formatDate` function is defined but never used in the render. Remove dead code.

---

**Summary**: 1 file (`PostFeedItem.tsx`), 4 small changes. Cleaner, more professional feed cards. RecommendationFeedItem already has correct hover behavior and no visibility badge — no changes needed there.

