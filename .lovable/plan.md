## Changes

### 1. Remove the "Opening existing entity" toast

**File:** `src/components/admin/CreateEntityDialog.tsx` — inside the `onOpenExisting` handler wired to `ExactUrlDuplicateDialog`.

Drop the `toast({ title: "Opening existing entity — ${c.name}" })` call. Keep everything else identical:
- Close the preflight dialog
- Reset form / preflight state
- `navigate(`/entity/${c.slug || c.id}`)`

Rationale: the route change is the feedback. A toast for a plain navigation is noise.

### 2. Fix cropped logos in the "Part of" card

**File:** `src/pages/EntityDetailV2.tsx` (~lines 985–994).

**Why images look inconsistent:** the parent thumbnail is rendered inside a fixed 48×48 square with `object-cover`. `object-cover` fills the box by *cropping* whatever doesn't fit.
- Cosmix's logo (`part_of_1.png`) is already roughly square → no visible crop, looks fine.
- Medicube's logo (`part_of-2.png`) is a wide wordmark → the sides get chopped off and it appears zoomed-in / cut.

Brand logos (which is what "Part of" almost always shows — a Brand parent) should never be cropped. They should be shown in full, letterboxed inside the tile.

**Fix:** switch the thumbnail to `object-contain` with a small inner padding and a neutral background, so both square icons and wide wordmarks render fully without distortion.

```tsx
<div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center p-1">
  <ImageWithFallback
    src={parentEntity.image_url}
    alt={parentEntity.name}
    className="w-full h-full object-contain"
    fallbackSrc={getEntityTypeFallbackImage(parentEntity.type)}
  />
</div>
```

This is a scoped, presentation-only change — no logic, no other components touched. The sibling "Part of" card in `src/components/entity-v4/EntitySidebar.tsx` is a separate surface and is **not** modified in this plan (let me know if you want it aligned too).

### Out of scope
- No changes to preflight logic, `ExactUrlDuplicateDialog`, or edge functions.
- No changes to the entity page hero, other thumbnails, or layout.
