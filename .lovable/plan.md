

# Fix Turnstile Layout Flicker: Portal + Delayed Init

## Problem

Turnstile injects an iframe immediately on mount. Even with `interaction-only` mode, the iframe participates in layout, causing visible reflow (form jumps up/down during the first second of page load). CSS-based fixes cannot solve this because the iframe is always present as a child element.

## Solution

Two changes working together:

### 1. React Portal (eliminates CLS)

Render Turnstile into a fixed, zero-size container outside the form's document flow using `createPortal()`. This is the core fix.

### 2. Delayed Initialization (eliminates render-time jank)

Wrap the Turnstile `render()` call in `requestIdleCallback` (with `setTimeout` fallback) so it initializes after first paint, not during critical rendering. This prevents script execution from blocking the initial frame.

## Files Modified

### `index.html`

Add a portal target div inside `<body>`, before `<div id="root">`:

```html
<div id="turnstile-root" style="position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;"></div>
```

Inline styles because Tailwind classes are not available in `index.html`.

### `src/components/auth/TurnstileWidget.tsx`

- Import `createPortal` from `react-dom`
- Use `createPortal` to render the container div into `#turnstile-root` instead of inline
- Fallback: if `#turnstile-root` is missing, render in-place with `[&:empty]:hidden` (safe degradation)
- Replace the existing `setTimeout(initWidget, 100)` with `requestIdleCallback(initWidget)` (falling back to `setTimeout(initWidget, 150)` for browsers that don't support it)

### `src/components/auth/SignUpForm.tsx`

No changes needed. The widget stays in the same JSX position; the portal handles relocation internally.

## Summary

| File | Change |
|---|---|
| `index.html` | Add zero-size `#turnstile-root` portal target |
| `src/components/auth/TurnstileWidget.tsx` | Portal rendering + `requestIdleCallback` delayed init |

## What this achieves

- Zero layout shift on page load
- No visible flicker or form jumping
- Bot protection remains fully functional
- Page feels stable from the first frame
- Works on slow devices too (delayed init prevents render blocking)

