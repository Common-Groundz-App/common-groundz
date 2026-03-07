

# Fix Entity Loading Screen: Slug → Name + Shimmer Bar (Final)

Both reviewers agree on one addition: wrap `decodeURIComponent` in a try/catch. Valid — malformed URIs would throw. Adding it.

Nothing else to add. The plan has been reviewed three times and is tight.

## Final Plan (4 files)

### 1. Create `src/utils/formatSlug.ts`
```ts
export function formatSlugAsName(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  return decoded
    .replace(/[-_]/g, " ")
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
```

### 2. Update `src/pages/EntityDetail.tsx` (~line 1070-1072)
- Import `formatSlugAsName`, apply to `displayName`

### 3. Update `src/components/entity-v4/EntityV4.tsx` (~line 434)
- Import `formatSlugAsName`, use: `entityName={entity?.name ?? formatSlugAsName(entitySlug)}`

### 4. Update `src/components/ui/entity-detail-loading-progress.tsx`
- Remove fake progress state/interval/bar
- Replace with indeterminate shimmer bar (CSS gradient animation looping left-to-right)
- Keep: spinner, entity name, fun fact, bouncing dots

