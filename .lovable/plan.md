

# Fix: Remove Extra Gap from Hidden Turnstile Widget

## Problem

The `<div ref={containerRef} className="turnstile-container" />` in `TurnstileWidget.tsx` takes up space in the `space-y-4` layout of `CardContent` even when the widget is invisible (interaction-only mode). This creates a visible gap between the Username field and the Create Account button.

## Fix

### `src/components/auth/TurnstileWidget.tsx`

Change the container div to have no height/margin when empty:

```
Before:  <div ref={containerRef} className="turnstile-container" />
After:   <div ref={containerRef} className="turnstile-container [&:empty]:hidden" />
```

The Tailwind `[&:empty]:hidden` utility hides the div entirely when it has no child elements (i.e., when the Turnstile widget is not rendered). When Cloudflare injects a challenge, the div gains children and automatically becomes visible.

## Files Modified

| File | Change |
|---|---|
| `src/components/auth/TurnstileWidget.tsx` | Add `[&:empty]:hidden` class to container div |

One file. One class added. No other changes.

