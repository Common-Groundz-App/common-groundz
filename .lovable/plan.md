
## Goal
Make the selected entity pills in the composer bigger and more prominent, closer to Reddit's community pill style.

## Changes

### `src/components/feed/composer/EntityHeroPill.tsx`

1. **Increase pill height** from `h-9` (36px) to `h-10` (40px) in the `PILL_BASE` constant.

2. **Increase avatar size** from `h-6 w-6` (24px) to `h-7 w-7` (28px) for both the image and the fallback circle. This gives the avatar stronger presence inside the taller pill.

3. **Increase font size** for the entity name from `text-sm` to `text-base` (via PILL_BASE or the name span) to match the larger pill proportionally.

4. **Slightly increase padding** on selected pills from `pl-1 pr-1` to `pl-1.5 pr-1.5` for better breathing room.

### No other files are modified.
