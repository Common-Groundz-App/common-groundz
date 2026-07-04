## Why the change didn't show up

The entity page you're looking at (`/entity/...`) renders its right column via `src/components/entity-v4/EntitySidebar.tsx`, not `src/pages/EntityDetailV2.tsx`. Both files contain a "Part of" card, and last turn I updated the wrong one — `EntityDetailV2.tsx` is a legacy/alternate surface that isn't mounted on this route, so the Medicube wordmark is still being rendered by `EntitySidebar` with `object-cover` and still gets cropped.

## Fix

**File:** `src/components/entity-v4/EntitySidebar.tsx` (lines 123–128)

Wrap the image in a letterbox tile and switch to `object-contain`, matching the fix already applied on the other surface:

```tsx
<div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center p-1">
  <ImageWithFallback
    src={parentEntity.image_url}
    alt={parentEntity.name}
    fallbackSrc={getEntityTypeFallbackImage(parentEntity.type)}
    className="w-full h-full object-contain"
  />
</div>
```

Also revert `EntityDetailV2.tsx` back to `object-cover`? No — leave it as-is so both surfaces stay consistent if that route is ever used.

## Out of scope
- No changes to layout, card size, spacing, or any other sidebar section.
- No logic changes.
