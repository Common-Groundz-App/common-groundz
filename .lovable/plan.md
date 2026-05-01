
## Context

The Tag Entities modal already passes location to the search hook, enabling blended ranking and distance labels. The Explore page uses the same hook but without location, so results lack proximity ranking and distance display.

ChatGPT suggested also passing `accuracy` — good idea in theory, but the `useGeolocation` hook only exposes `{ latitude, longitude }` today. Both the composer and Explore will be consistent: neither passes accuracy, and the backend treats `null` accuracy as "show labels" (`accuracy == null || accuracy <= 2000`). No extra geolocation changes needed.

## Changes

### 1. `src/pages/Explore.tsx` — Pass location to search hook

- Import `useLocation` from `@/contexts/LocationContext`
- Extract `locationEnabled` and `position` (same pattern as `UnifiedEntitySelector`)
- Derive `locationActive = locationEnabled && !!position`
- Pass `location: { enabled: locationActive, latitude: position?.latitude, longitude: position?.longitude }` to the `useEnhancedRealtimeSearch` call

### 2. `src/components/search/SearchResultHandler.tsx` — Show distance label for external results

- After the venue line, add a conditional block rendering `result.metadata?.distance_label`
- Style: `text-[11px] text-primary font-medium` (matches tag entities modal)

### 3. `src/components/search/EntityResultItem.tsx` — Show distance label for "On Groundz" entities

- After the venue line, add a conditional block rendering `entity.metadata?.distance_label`
- Same styling as above

### No backend changes

The `unified-search-v2` and `search-places` edge functions already accept location parameters, compute distances, and return `distance_label` in metadata.
