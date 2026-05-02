
## Goal
Upgrade the EntityHeroPill component to show Reddit-style pills with circular entity images and bold names, replacing the current plain emoji icons.

## Changes

### `src/components/feed/composer/EntityHeroPill.tsx`

1. **Import `getOptimalEntityImageUrl`** from `@/utils/entityImageUtils` to get the best available image for each entity.

2. **Add a circular image component** inside each selected entity pill:
   - 20x20px circular image (`rounded-full object-cover`) on the left
   - Falls back to a colored circle with a type-appropriate emoji/icon if no image exists
   - Fallback circle uses a subtle type-based background color

3. **Bold entity name**: Change from `font-medium` to `font-semibold` for selected entity pills (matching Reddit's bold community name).

4. **Slightly increase pill height** from `h-8` to `h-9` to accommodate the circular image comfortably.

5. **Keep everything else unchanged**: the empty state pill, the "Add more" ghost pill, the X remove button, and the flex-wrap layout all stay the same.

### No other files are modified.
