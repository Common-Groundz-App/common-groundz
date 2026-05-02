
## Problem

The composer's Tag Entities modal saves recent searches as raw query text (e.g. "isha founda"). Clicking a recent just refills the search bar, forcing the user to re-search and re-select. The Explore page saves entity-kind recents with full metadata and navigates directly — the composer should do the equivalent: directly add the entity chip.

## What Changes

All changes in **one file**: `src/components/feed/UnifiedEntitySelector.tsx`.

The `useRecentSearches` hook and `RecentSearchesPanel` already support entity-kind items and pass the full `RecentSearchItem` via `onPick(query, item)` — no changes needed there.

### 1. Save entity-kind recents on selection

In `handleEntitySelect` (line 213), replace:

```ts
if (searchQuery.trim()) addRecent(searchQuery.trim());
```

with:

```ts
addRecent(entity.name, 'entity', {
  entityId: entity.id,
  entityType: entity.type,
});
```

This saves the actual selected entity name and metadata instead of the partial typed query. Slug is omitted since it's not needed for composer tagging (EntityAdapter doesn't carry it, and we don't navigate).

### 2. Handle entity-kind recents in onPick

Update the `onPick` callback (line 776) to accept the full `RecentSearchItem` and handle entity-kind items directly:

```ts
onPick={(q, item) => {
  // Entity-kind recent: add directly as a tag chip
  if (item?.kind === 'entity' && item.entityId) {
    // Guard: max limit and duplicate check
    if (isMaxReached) return;
    if (selectedEntities.some(e => e.id === item.entityId)) return;

    // We have enough metadata to add directly
    const adapter: EntityAdapter = {
      id: item.entityId,
      name: item.query,        // entity name stored as query
      type: item.entityType || 'other',
    };
    const newEntities = [...selectedEntities, adapter];
    setSelectedEntities(newEntities);
    onEntitiesChange(newEntities);
    return;
  }

  // Query-kind recent: fill search input (existing behavior)
  setSearchQuery(q);
  setDebouncedQuery(q);
  setShowResults(true);
  inputRef.current?.focus();
}}
```

No fallback fetch needed. The recent item stores `entityId`, `name`, and `entityType` — that's everything `EntityAdapter` requires. If the entity was deleted or changed, the chip will still render; any issues surface naturally when the post is submitted.

### Why no fallback fetch or image storage

- `EntityAdapter` requires only `id`, `name`, `type` — all stored in the recent item.
- Image URLs can change and would bloat localStorage. The entity pills in the composer don't display images anyway.
- A Supabase fetch for every recent click adds latency and complexity for no user-visible benefit in the tagging flow.
- Old query-only recents (before this change) keep working — they fill the search input as before.

### Constraints respected

- Max 3 entity limit: checked via `isMaxReached`
- No duplicates: checked via `selectedEntities.some()`
- No changes to `useRecentSearches.ts`, `RecentSearchesPanel`, or any other file

## Files changed

| File | Change |
|------|--------|
| `src/components/feed/UnifiedEntitySelector.tsx` | Save entity-kind recents in `handleEntitySelect`; handle entity-kind recents directly in `onPick` |
