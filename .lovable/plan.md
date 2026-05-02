
## Goal
Replace the basic Badge-based entity chips in the Tag Entities modal with the same Reddit-inspired pill design used in the composer, scaled down slightly to suit the modal context.

## Rationale
The composer uses `EntityHeroPill` with circular entity images, emoji fallbacks, and semibold text. The modal currently uses plain `Badge` components with just an emoji and name -- no image, no visual weight. This creates a jarring inconsistency between the two views.

A slightly smaller variant (h-8 instead of h-10, h-5 w-5 avatar instead of h-7 w-7) keeps the same design language while fitting naturally inside the modal's tighter space.

## Changes

### `src/components/feed/UnifiedEntitySelector.tsx` (lines 622-643)

Replace the `Badge`-based selected entities section with pills that mirror the `EntityHeroPill` design:

- Import `getOptimalEntityImageUrl` (already imported) and reuse the same `getEntityIcon` helper already in the file
- For each selected entity, render a rounded-full pill with:
  - **h-8** height (compact for modal, vs h-10 in composer)
  - **h-5 w-5** circular entity image with `object-cover`, or emoji fallback in a colored circle
  - **text-xs font-semibold** entity name (smaller than composer's text-sm)
  - Same `X` remove button pattern
  - Same `border-primary/20 bg-primary/5` coloring as the composer pills
- Remove the `Badge` import if no longer used elsewhere in the file (it is not)

No other files are modified.
