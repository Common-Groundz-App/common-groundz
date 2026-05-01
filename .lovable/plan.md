## Fix: Duplicate function declarations in unified-search-v2

The edge function is crashing with `Identifier 'haversineKm' has already been declared` because `haversineKm` and `formatDistanceLabel` were added at the top of the file (lines 5-20) but identical copies already existed at lines 312-328 (inside the `searchPlaces` section).

### Change

**`supabase/functions/unified-search-v2/index.ts`** — Remove the duplicate declarations at lines 312-328 (the second `haversineKm` and `formatDistanceLabel` functions). The copies at lines 5-20 stay and serve both `searchPlaces` and the new local-entity distance injection.

Then redeploy the edge function.
