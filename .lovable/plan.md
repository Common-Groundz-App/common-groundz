
## Changes

**File: `src/components/feed/EnhancedCreatePostForm.tsx`**

### 1. Suggested hashtags orange tint (lines 1086-1094)

Change suggested hashtag badges from neutral `variant="outline"` to a soft orange-tinted style: `bg-primary/5 border-primary/20 text-primary`. Keep user-typed/detected tags neutral.

```tsx
<Badge
  key={tag}
  variant="outline"
  onClick={() => handleSuggestedHashtagClick(tag)}
  className="cursor-pointer hover:bg-primary/10 gap-1 font-normal bg-primary/5 border-primary/20 text-primary"
>
```

### 2. Dynamic body placeholder (line 1032)

Replace the static `getPlaceholderForType(postType)` with entity-aware copy:

- No entity selected: `"Tag a product, place, book, or movie to give your experience context..."`
- Entity selected: `"Tell us about your experience with [first entity name]..."`

```tsx
placeholder={
  entities.length > 0
    ? `Tell us about your experience with ${entities[0].name}...`
    : 'Tag a product, place, book, or movie to give your experience context...'
}
```

No other files or components are modified.
