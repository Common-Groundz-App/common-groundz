
## Problem

When picking an entity from "recent searches" in the Tag Entities modal, the chip renders without an avatar because `image_url` is not stored in the recent search item or passed through when constructing the `EntityAdapter`.

## Solution

Extend the recent search system to carry `image_url` for entity-kind items, and pass it through when adding the chip from recents.

## Changes

### 1. `src/hooks/useRecentSearches.ts`

- Add optional `image_url?: string` to the `RecentSearchItem` interface.
- Accept `image_url` in the `addRecent` meta parameter and persist it.

### 2. `src/components/feed/UnifiedEntitySelector.tsx`

- In `handleEntitySelect` (line 213): pass `image_url` when saving the recent:
  ```
  addRecent(entity.name, 'entity', {
    entityId: entity.id,
    entityType: entity.type,
    image_url: entity.image_url,
  });
  ```

- In the `onPick` callback (line 785): include `image_url` from the recent item when constructing the adapter:
  ```
  const adapter: EntityAdapter = {
    id: item.entityId,
    name: item.query,
    type: item.entityType || 'other',
    image_url: item.image_url,
  };
  ```

This is a minimal 2-file change. Old recents without `image_url` will still work -- the chip just won't show an avatar (same as today), and they'll naturally cycle out.
