# Give the unread badge breathing room again

## The problem

The new shared badge sits flush against the bell glyph. The old badge read better because there was a visible gap between the icon strokes and the badge edge — the badge looked like a separate object floating over the icon, not a shape glued to it.

The current overlay style is `absolute -top-1 -right-1 h-4 min-w-4 px-1` with no separating ring, so the badge outline touches the bell.

## The fix (presentation only)

Change the `overlay` variant in `src/components/notifications/NotificationBadge.tsx`:

- Add a background-colored ring around the badge: `ring-2 ring-background`. This carves a visible gap between the badge and whatever is under it (bell strokes, avatar edge) in both light and dark mode, using the theme token rather than a hardcoded white.
- Nudge the offset out slightly to `-top-1.5 -right-1.5` so the ring reads as a gap instead of eating into the badge's own footprint.
- Keep everything symmetrical: `h-4 min-w-4 px-1`, `rounded-full`, flex-centered, `leading-none` — a single digit stays a perfect circle and `9+` grows evenly on both sides.

Nothing else changes: same `9+` cap, same `bg-destructive` tokens, same null/zero handling, same `inline` variant for the desktop sidebar (it sits in normal flow and needs no ring).

## Result

Every compact entry point (top nav bell, Feed header, My Stuff header, Post View header, mobile bottom nav) picks up the gap automatically since they all render the shared component.
