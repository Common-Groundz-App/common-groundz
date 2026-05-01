## Problem

When location is enabled, external Google Places results show distance labels (e.g. "824 m away") but local "On Groundz" entities don't, even though they were originally created from Google Places and have `metadata.location` (lat/lng) stored in the database.

## Approach

Compute distance for local entities **server-side** in the `unified-search-v2` edge function, matching the same pattern used for external places results.

## Changes

### 1. `supabase/functions/unified-search-v2/index.ts`

- Add the same `haversineKm` and `formatDistanceLabel` helper functions already present in `search-places/index.ts`.
- Accept `latitude`, `longitude`, `accuracy`, `locationEnabled` parameters from the request body (same as already sent for external search).
- After fetching local entities, for each entity that has `metadata.location.lat` and `metadata.location.lng`, compute Haversine distance and inject `metadata.distance_label` and `metadata.distance_km` into the response.
- Only show distance labels when `accuracy <= 2000` (same rule as external results).
- This applies to both `local-only` and `quick` modes.

### 2. `src/hooks/use-enhanced-realtime-search.ts`

- Pass location data (`buildLocationBody()`) to the **local** search call as well (currently only passed to external/quick mode).
- This is a one-line change: add `...buildLocationBody()` to the local search body on ~line 265.

### What stays the same

- The `UnifiedEntitySelector.tsx` already renders `entity.metadata?.distance_label` for all entities — no UI changes needed.
- The distance rendering, pill UI, session toggle, and accuracy threshold logic all remain unchanged.

## Technical notes

- Not all "On Groundz" entities will have `metadata.location` — only place-type entities created from Google Places. Non-place entities (books, movies, products) will simply have no distance label, which is correct.
- The Haversine + formatting functions are duplicated from `search-places`; this is acceptable since edge functions are isolated Deno modules that can't share code.
