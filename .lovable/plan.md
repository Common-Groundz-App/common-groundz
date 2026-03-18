

# Final Plan — Offline Snackbar Refinements

## Assessment of Codex suggestion

**Adopt it** — it's a one-line addition. Framer Motion has a built-in `useReducedMotion()` hook. We conditionally set `transition: { duration: 0 }` when reduced motion is preferred. Trivial to add, completes the accessibility story.

## Nothing else to add

This plan has been reviewed enough times. Every meaningful improvement has been captured. Time to ship.

## Complete changes

### `src/components/OfflineBanner.tsx` — rewrite

1. **Centering**: `left-1/2 -translate-x-1/2` with `min-w-[200px] max-w-[calc(100vw-2rem)]`
2. **Smooth transitions**: `transition-all duration-200 ease-out` on inner div
3. **Tap feedback**: `active:scale-95 transition-transform` on Retry button
4. **Reconnecting state**: When `isRetrying` → replace pill content with `<Loader2 spin /> Reconnecting...` + `animate-pulse` on container. No grey-out.
5. **Copy**: "Reconnecting..." instead of "Retrying..."
6. **Accessibility**: `role="status"` and `aria-live="polite"` on all pill containers
7. **Framer Motion easing**: Add `ease: 'easeOut'` to all `transition` props
8. **Framer Motion reduced motion**: Import `useReducedMotion` from framer-motion. When true, set `transition: { duration: 0 }` on all motion components
9. **State table** (unchanged):

| State | Icon | Label | Action |
|---|---|---|---|
| Offline | WifiOff | You're offline | Retry (`active:scale-95`) |
| Reconnecting | Loader2 (spin) | Reconnecting... | None, pill pulses |
| Still offline | WifiOff | Still offline | None, 1.5s revert |
| Back online | Wifi | Back online | None |

### `src/index.css` — one line

Extend existing `prefers-reduced-motion` rule to also disable `animate-spin`.

### Files touched

- `src/components/OfflineBanner.tsx`
- `src/index.css`

