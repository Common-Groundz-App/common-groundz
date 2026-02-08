

# Fix: Sonner Toasts Not Rendering

## Problem

The gateway fix is working correctly — it returns 409 with `USER_EXISTS` code, and the frontend code handles it properly by calling `toast.error(...)`. However, **the toast never appears** because the Sonner `Toaster` component is not mounted in the app.

**Root cause:** `App.tsx` imports `Toaster` from `@/components/ui/toaster` (radix/shadcn toaster), but all auth components (and many others across the app) use `toast()` from the `sonner` library. The Sonner renderer (`@/components/ui/sonner.tsx`) exists but is never mounted anywhere.

This means every `toast()` call from sonner across the entire app has been silently failing.

## Fix

### `src/App.tsx` — Add the Sonner Toaster

Add the Sonner Toaster alongside the existing radix Toaster:

- Import `Toaster as SonnerToaster` from `@/components/ui/sonner`
- Add `<SonnerToaster />` next to the existing `<Toaster />` on line 225

This is a one-line import and one-line JSX addition. No other changes needed.

## Files Modified

| File | Change |
|---|---|
| `src/App.tsx` | Import and mount the Sonner Toaster component |

One file. Two lines added. Everything else stays exactly the same.

## Why this fixes the issue

The auth gateway correctly returns 409 with `USER_EXISTS`. The SignUpForm correctly checks `result.code === 'USER_EXISTS'` and calls `toast.error(...)`. The only missing piece is the Sonner renderer to actually display the toast in the DOM.

