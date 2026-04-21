

## Verdict: Yes — adopt both reviewers' additions. Both are real concerns, both are cheap.

ChatGPT and Codex independently flagged the same race-condition risk (rapid clicks → duplicate creates), and Codex caught a real typing bug I missed. Adding both. Plus one more thing I noticed on a re-read.

---

## What I'm adding to the previous plan

### 1. Selection lock (both reviewers)
A single `isCreatingEntity` state in `UnifiedEntitySelector`. While `handleExternalSelect` is in flight:
- Early-return if already creating (guards against double-fire even before React re-renders)
- Pass a `disabled` / `busy` flag down so the result row shows a small spinner and ignores further clicks on **any** external result (not just the one clicked — prevents picking a different result mid-create)
- Always clear in `finally`

This also closes a subtle dedupe race: two fast clicks on the same brand-new external result could both miss `findEntityByApiRef` (neither has been inserted yet) and both call `createEntityQuick`, creating two rows. The lock prevents that.

### 2. Normalize `type` before create (Codex)
External results come in with `type` strings from different sources (`'place'`, `'book'`, `'movie'`, sometimes missing). The previous plan had `result.type || 'product'` as a fallback — that would silently mis-type a Google Places result as `'product'` if `type` is ever undefined. Fix:

```ts
const normalizedType = normalizeEntityType(result.type, result.api_source);
// e.g. api_source='google_places' → 'place'
//      api_source='google_books' → 'book'
//      api_source='omdb'/'tmdb' → 'movie'
//      else → result.type, else 'product'
```

This helper already exists in spirit in `use-entity-operations.ts` (`getCorrectEntityType`). I'll reuse/extract it rather than reinvent it — keep one source of truth for the api_source → type mapping.

### 3. **My addition: skip the create call entirely if `api_source` or `api_ref` is missing**
A defensive guard. If for some reason an external result lacks one of these (malformed data, future regression), `findEntityByApiRef` will short-circuit to `null` and we'll happily insert a duplicate-prone row with no dedupe key. Guard:

```ts
if (!result.api_source || !result.api_ref) {
  toast({ title: 'Could not add this result', variant: 'destructive' });
  return;
}
```
External results without dedupe keys should go through the explicit "+ Add as new entity" dialog instead, not the auto-create path.

---

## Final plan (unchanged where not noted)

### Files changed (1)
**`src/components/feed/UnifiedEntitySelector.tsx`** — rewrite `handleExternalSelect`:

1. Guard: bail if `isCreatingEntity` already true, or if `api_source`/`api_ref` missing
2. Set `isCreatingEntity = true`
3. Compute `normalizedType` via shared helper
4. `findEntityByApiRef(api_source, api_ref)` — dedupe
5. If null, `createEntityQuick({...}, normalizedType)`
6. If `api_source === 'google_places'` and we have `entity.id` + `api_ref`, fire `refresh-google-places-entity` (non-blocking, `.catch(console.error)`)
7. `handleEntitySelect(entity)` to add chip
8. `finally { setIsCreatingEntity(false) }`
9. Pass `isCreatingEntity` into the result list so external rows render `disabled` + small spinner on the active row

### Files possibly touched (small)
**`src/hooks/recommendations/use-entity-operations.ts`** — extract the existing `getCorrectEntityType` helper into a shared util (or export it) so `UnifiedEntitySelector` can import it. No behavior change to existing callers.

If extracting feels risky, I'll inline a small private copy in `UnifiedEntitySelector` instead — call it. The mapping is 5 lines.

### Explicitly NOT touching
- No new edge function (the whole point — reuse Explore's client path)
- No DB migration, no schema change
- No changes to `SearchResultHandler` / Explore (already works — we're mirroring it)
- No changes to local-entity selection ("Already on Groundz" rows)
- No changes to `CreateEntityDialog` ("+ Add as new entity")
- No changes to location flow (last turn's `structured_fields.location` work)
- No changes to mentions, hashtags, sound, post submission, structured fields

---

## Verification

1. `/create` → search "malika biryani" → click a **Places** result → chip appears, **no CORS error**, no `FunctionsFetchError`
2. Search same name again → result now appears under **"Already on Groundz"**
3. Click that "Already on Groundz" result → tagged, no new row in `entities` (verify in Supabase)
4. **Rapid double-click** on a brand-new external result → only one entity row created, second click is ignored while spinner shows
5. **Click result A then quickly result B** during create → result B click ignored until A completes
6. Books result → chip appears, second search shows it under "Already on Groundz", row has `type='book'` (not `'product'`)
7. Movies result → same, row has `type='movie'`
8. Google Places pick → background `refresh-google-places-entity` fires (check edge function logs)
9. Local entity click → still works
10. "+ Add as new entity" dialog → still works
11. Location pin → still writes `structured_fields.location` (last turn's fix intact)
12. Submit post with tagged entity → row in `post_entities` join table
13. Console clean of CORS / NET::ERR_FAILED on entity selection

