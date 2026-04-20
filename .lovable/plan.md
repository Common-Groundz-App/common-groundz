

## Verdict: Yes — both reviews are right. Adopt their additions, plus one more I caught.

Both reviews converge on the same point: **add input validation before persisting**. ChatGPT split it into two checks (name + coordinates), Codex bundled it as one. Same idea, both worth doing. They're cheap, they prevent garbage data, and they're exactly the kind of guard you want at a storage boundary.

I also caught one more thing while re-reading the plan that neither review mentioned — see #3 below.

---

## What I'm adding to the plan

### 1. Guard: skip location entirely if `name` is empty/whitespace
```ts
const trimmedName = location?.name?.trim();
const locationPayload = trimmedName ? { ... } : null;
```
Prevents `{ "location": { "name": "  " } }` rows.

### 2. Guard: normalize coordinates — store only if both `lat` and `lng` are finite numbers
```ts
const coords =
  typeof location?.coordinates?.lat === 'number' &&
  typeof location?.coordinates?.lng === 'number' &&
  Number.isFinite(location.coordinates.lat) &&
  Number.isFinite(location.coordinates.lng)
    ? { lat: location.coordinates.lat, lng: location.coordinates.lng }
    : null;
```
Then `coordinates: coords` (so a partial/string-shaped object becomes `null`, never half-stored). Apply the same validation inside `cleanStructuredFields` so any path into the column is safe — not just the composer.

### 3. **My addition: also validate on hydrate, not just on write**
The plan validates on write but trusts whatever's in the DB on read. If an old row has a malformed `location` (from before this fix, or from a future bug), the edit screen will silently load garbage into local state.

Add a tiny `isValidStoredLocation(loc)` helper used in **both** places:
- On hydrate: only call `setLocation(...)` if `isValidStoredLocation(sf.location)`
- Inside `cleanStructuredFields`: only accept the location key if `isValidStoredLocation(input.location)`

One helper, two call sites, zero `as any` leakage. This is the "consistent shape everywhere" point ChatGPT hinted at, made concrete.

---

## What I'm explicitly NOT adding

- No DB migration / no `metadata` column
- No refactor of `LocationSearchInput`'s prop shape (still uses camelCase locally; we normalize at the storage boundary only — out-of-scope refactor otherwise)
- No `tags` change (kept for discovery layer)
- No new map/nearby/discovery features (those are next-step work, this just unblocks them)
- No touching mentions, entities, hashtags, sound, edit-window, visibility, etc.

---

## Final file changes (still just 2 files)

**`src/types/structuredFields.ts`**
- Add `PostLocation` interface with strict `coordinates: { lat: number; lng: number }`
- Add `location?: PostLocation` to `StructuredFields`
- Add `'location'` to `ALLOWED_STRUCTURED_KEYS`
- Add `isValidStoredLocation(loc): loc is PostLocation` helper (checks name non-empty + coords finite-or-absent)
- In `cleanStructuredFields`: pass `mapped.location` through `isValidStoredLocation` before accepting

**`src/components/feed/EnhancedCreatePostForm.tsx`**
- Build `locationPayload` only when `name.trim()` is non-empty; coords normalized via the finite-number check
- Merge into `structured_fields` via existing `cleanStructuredFields` flow
- After merge, delete `location` key if `locationPayload` is null (so clearing on edit drops the data, doesn't store null)
- On edit hydrate: use `isValidStoredLocation(sf.location)` gate before `setLocation(...)`, mapping `place_id` → `placeId` for local state
- Keep `tags: [location.name]` unchanged

---

## Verification

1. **Create with location** → DB row has `structured_fields.location = { name, address, place_id, coordinates: { lat, lng } }`
2. **Edit hydrates** → location chip pre-fills correctly
3. **Clear on edit** → `location` key gone from row (not stored as null)
4. **Whitespace-only name** (force via devtools) → location dropped, no row pollution
5. **Malformed coordinates** (e.g. `{ lat: "12.9" }`) → coordinates stored as `null` or omitted, never half-stored
6. **Old row with garbage location** → edit screen ignores it cleanly, no crash
7. **No location** → `structured_fields.location` absent
8. **Existing posts** → load and edit normally; no regression
9. **`tags`** → still contains `[location.name]` when set
10. **`tsc`** clean, no `as any` near location read/write

