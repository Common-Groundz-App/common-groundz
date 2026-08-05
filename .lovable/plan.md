# Notification action styling — brand-aligned Follow back / Following

Scope: the action slot in the notification drawer row only. No layout, logic, or behaviour changes.

## What changes

1. **Follow back** becomes a primary brand-orange action, matching how a social user-follow already looks elsewhere in the app (solid orange, white label). It reads as "action required".
2. **Following** becomes a pill of the same size and shape as Follow back, using the soft orange muted treatment already used app-wide for the followed state (`bg-brand-orange/10`, muted text). It reads as "already done" — visually settled, not shouting.

This mirrors the Instagram pattern in your reference: dominant colour for pending actions, muted-but-contained chip for completed state, and both occupying the same footprint so rows do not shift when the state flips.

## Deliberate details

- Both states share identical height, horizontal padding, radius, and text size, so switching from Follow back to Following causes zero layout jump.
- "Following" stays **non-interactive**: same pill shape, but not a real button and not focusable. The drawer can follow, never unfollow — a pressable-looking control that does nothing would be worse UX than a static chip. It gets an accessible label so screen readers announce the state.
- The pending state keeps the existing spinner, now inside the orange pill, and stays disabled.
- Colours come from existing brand tokens; nothing new is introduced and dark mode is covered because the muted state uses a translucent brand tint over the row background.

## Suggestions beyond the colour swap

- Keep the unread row tint as-is; the orange pill still reads clearly on the tinted background since the pill is solid.
- Do not add an "Unfollow" affordance here. Instagram's Following chip is tappable, but our drawer intentionally has no unfollow path, and the profile page already owns that.
- Optional, say the word if you want it: a very subtle scale/opacity transition when Follow back flips to Following, so the state change registers without a toast being the only feedback.

## Technical section

- File: `src/components/notifications/NotificationList.tsx`, action slot at lines 228–254.
- Follow back: `Button` with brand-orange solid classes (`bg-brand-orange text-white hover:bg-brand-orange/90`), keeping `size="sm" h-7 px-2.5 text-xs`, `disabled={followPending}`, `aria-label`, and `stopPropagation` in `onClick` unchanged.
- Following: replace the bare `<span className="text-xs text-muted-foreground">` with a styled non-interactive span — `inline-flex items-center justify-center h-7 px-2.5 text-xs rounded-md bg-brand-orange/10 text-muted-foreground font-medium` — plus `aria-label="Following"`.
- `pointer-events-auto relative z-10` wrapper, the `followStatus !== 'unknown'` gate, and `useFollowBackState` remain untouched.
