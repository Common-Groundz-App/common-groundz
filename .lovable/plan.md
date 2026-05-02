
## Goal
Fix the max-entity UX: hide "Add more" at the limit and improve the modal fallback message.

## Changes

### 1. `src/components/feed/composer/EntityHeroPill.tsx`
- Add a `maxEntities` prop (default 3).
- Only render the "+ Add more" button when `entities.length < maxEntities`.

### 2. `src/components/feed/UnifiedEntitySelector.tsx`
- Change the `isMaxReached` message from "You can add up to {maxEntities} tags" to "You've selected {maxEntities} entities. Remove one to add another."

### 3. Parent composer wiring
- Pass `maxEntities={3}` to `EntityHeroPill` wherever it's rendered.

No changes to the actual max limit value or entity selection logic.
