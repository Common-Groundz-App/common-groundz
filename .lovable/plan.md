

# Fix: Entity Old-Slug Redirection

## What This Fixes

When visiting an old entity URL (e.g., `/entity/the-terminator` after renaming), the page shows "Entity not found" instead of redirecting to the current slug. The slug history is recorded correctly in the database, but the frontend fetch layer doesn't check it.

## Why It Matters

- Shared links and bookmarks break after a rename
- SEO ranking drops when old URLs return "not found"
- The username system already handles this correctly -- entities should match

## Changes (5 files)

### 1. `src/services/entityService.ts` -- Make `fetchEntityBySlug` history-aware

Add a typed return interface:

```typescript
export interface EntityFetchResult {
  entity: Entity | null;
  matchedVia: 'current' | 'id' | 'history';
  canonicalSlug: string | null;
}
```

Update `fetchEntityBySlug` to return `EntityFetchResult`:
- Step 1: Try `entities.slug` -- return `matchedVia: 'current'`
- Step 2: Try `entities.id` (if UUID) -- return `matchedVia: 'id'`
- Step 3: Call `resolveSlugWithHistory()` from `entityRedirectService.ts` -- return `matchedVia: 'history'` with `canonicalSlug`
- Step 4: Return `{ entity: null, matchedVia: 'current', canonicalSlug: null }`

Keep a backward-compatible wrapper (`fetchEntityBySlugSimple`) returning `Entity | null` for callers like `fetchEntityWithParentContext` that don't need redirect info.

### 2. `src/hooks/use-entity-detail.ts` -- Expose `redirectToSlug`

- Use the new `EntityFetchResult` from `fetchEntityBySlug`
- When `matchedVia === 'history'`: set entity normally, do NOT set error, store `canonicalSlug` as `redirectToSlug`
- Add `redirectToSlug: string | null` to the return value

### 3. `src/hooks/use-entity-detail-cached.ts` -- Expose `redirectToSlug`

- Same adjustment: use `EntityFetchResult`, don't throw when matched via history
- Add `redirectToSlug` to the `EntityDetailData` interface and return value

### 4. `src/pages/EntityDetail.tsx` -- Redirect before "not found" render

Before the existing "not found" check at line 201, add:

```typescript
if (redirectToSlug && redirectToSlug !== entitySlug) {
  navigate(`/entity/${redirectToSlug}`, { replace: true });
  return null;
}
```

This runs after data is loaded, so there's no flash of "Entity not found."

### 5. `src/components/entity-v4/EntityV4.tsx` -- Same redirect check

Before the "not found" check at line 436, add the same redirect guard using `redirectToSlug` from `useEntityDetailCached`.

## What Does NOT Change

- Database functions or triggers (migration already applied)
- `entityRedirectService.ts` (reused internally, not modified)
- `entity_slug_history` table structure
- RLS policies
- Any other pages or components

## Verification After Implementation

1. Create entity "test-redirect"
2. Rename to "test-redirect-new" (old slug recorded in history)
3. Visit `/entity/test-redirect` -- should load entity and URL changes to `/entity/test-redirect-new`
4. No "Entity not found" flash at any point
5. Visit `/entity/test-redirect-new` directly -- loads normally, no redirect

