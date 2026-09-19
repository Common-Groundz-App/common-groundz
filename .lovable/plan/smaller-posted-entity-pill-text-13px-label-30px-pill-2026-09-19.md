# Smaller posted entity pill text (13px label, 30px pill)

## What changes

Only the read-only tag shown under a posted card gets smaller. The label drops from 14px to 13px, and the pill scales down with it so the text isn't floating in dead space.

| Part | Now | After |
|---|---|---|
| Pill height | 34px | 30px |
| Thumbnail | 24px | 22px |
| Label size | 14px | 13px |
| Label weight | medium | medium (unchanged) |
| Tint / border / text color | soft orange | unchanged |
| Horizontal padding | 4px left, 10px right | 3px left, 8px right |
| Gap image → text | 4px | 3px |

The 13px label sits clearly below the 14px post body, so the tag finally reads as supporting context rather than competing with the post text.

## What stays exactly as it is

- Soft orange tint, light orange border, near-black readable label.
- Circular thumbnail, and the shared missing/broken-image fallback.
- Long names: wraps naturally, truncates only when the row truly runs out of room, tooltip only when the name is actually cut (measured, not guessed).
- Clicking or using the keyboard opens the entity page; the card behind it is never triggered by mistake.
- The /create composer pill, the post body, media, action row (like / comment / save / share), counts, comments, save and share behavior, and the rating badge are all untouched.
- No database, routing, or type changes.

## How it gets verified

1. Run the test suite (currently 664 tests), the type check, and lint on the changed file.
2. Measure the live pill on the two real cards used before — the two-entity review post and the long perfume-name post — at desktop and mobile width, in light and dark mode: expect 30px tall, 13px label, 22px thumbnail, tooltip only on genuinely truncated names, no console errors.
3. Screenshot the pills in context and update the verification notes plus the roadmap entry.
4. Stop for visual approval before anything else.

## Technical details

- Single file touched: `src/components/feed/PostedEntityPill.tsx` — the pill `className` (`h-[34px]` → `h-[30px]`, `text-sm` → `text-[13px]`, `pl-1 pr-2.5` → `pl-[3px] pr-2`, `gap-1` → `gap-[3px]`) and the thumbnail `className` on `EntityImage` (`h-6 w-6` → `h-[22px] w-[22px]`).
- The measured-overflow logic (`labelRef` + `ResizeObserver`), the `TooltipProvider` wrapper, `aria-label`, `stopPropagation` handlers, and `navigate(getEntityUrl(entity))` are not modified.
- `src/components/feed/composer/EntityHeroPill.tsx` and `src/components/common/EntityImage.tsx` are not modified; they keep their own sizing.
- Test suite runs via `bunx vitest run` (the repo's vitest tests are not compatible with `bun test`).
