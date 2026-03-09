

# Final Plan: Post Page Loading Screen

Both suggestions are already covered:

1. **React keys** — The current `FeedSkeleton` uses `[1, 2, 3].map((item) => <Card key={item}>...)`, so switching to `Array.from({ length: count }, (_, i) => ...)` with `key={i}` maintains stable keys. Will include.

2. **Spacing/margins for single card** — `FeedSkeleton` wraps cards in `<div className="space-y-6">`. With `count={1}`, `space-y-6` has no effect (only one child), so no extra gaps. No issue.

Nothing else to add — the plan is solid and ready to implement.

## Changes (2 files)

### `src/components/feed/FeedSkeleton.tsx`
- Add optional `count` prop defaulting to `3`
- Replace `[1, 2, 3].map(...)` with `Array.from({ length: count }, (_, i) => <Card key={i}>...)`

### `src/components/content/PostContentViewer.tsx`
- Import `FeedSkeleton`, remove `Shell` import
- Replace loading block with:
```tsx
<div className="p-4 sm:p-6">
  <FeedSkeleton count={1} />
</div>
```

No other files changed.

