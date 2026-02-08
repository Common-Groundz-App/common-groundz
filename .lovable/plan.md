

# Fix: Turnstile Widget Invalid Size Parameter

## Problem

The Turnstile widget uses `size: 'invisible'`, which is not a valid value in the current Cloudflare Turnstile API. Valid values are `'compact'`, `'flexible'`, or `'normal'`. This causes the widget to crash, which triggers the cascade of 401 errors from Cloudflare.

## What about the other console errors?

- **CSP / script-src warnings**: These are browser-level Content Security Policy notices about Cloudflare's own scripts. Not controllable from app code.
- **MetaMask**: The user has the MetaMask browser extension installed. This is MetaMask's own deprecation warning — not related to the app.
- **AudioContext warnings**: Chrome's autoplay policy. Standard browser behavior, not a bug.
- **401 errors on challenges.cloudflare.com**: These are a direct consequence of the Turnstile crash. Fixing the size parameter resolves these.

**Only the Turnstile size parameter is an actual app bug. Everything else is external.**

## Fix

### `src/components/auth/TurnstileWidget.tsx`

One line change on line 56:

```
Before:  size: 'invisible'
After:   size: 'flexible'
```

`'flexible'` is the best replacement because:
- It adapts to the container width automatically
- It has the smallest visual footprint among valid options
- It's the closest behavior to what "invisible" was intended to achieve

Also update the `TurnstileOptions` type interface (line 29) to remove `'invisible'` from the size union type so this can't regress:

```
Before:  size?: 'normal' | 'compact' | 'invisible';
After:   size?: 'normal' | 'compact' | 'flexible';
```

## Files Modified

| File | Change |
|---|---|
| `src/components/auth/TurnstileWidget.tsx` | Change `size: 'invisible'` to `size: 'flexible'` and update the type definition |

One file. Two lines. No other changes.

