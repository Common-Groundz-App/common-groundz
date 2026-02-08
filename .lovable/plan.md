

# Minimize Turnstile Widget Visibility and Add Theme Support

## Context

The visible "Success!" checkbox you see is the **Managed mode** widget from Cloudflare. Making Turnstile truly invisible (no widget at all) requires changing the **widget type in the Cloudflare dashboard** from "Managed" to "Invisible" -- it is NOT a code-side setting. However, per project history, invisible mode caused 401 crashes and initialization failures, so it was explicitly avoided.

**What we CAN do in code:**

1. Use `appearance: 'interaction-only'` -- the widget only shows if Cloudflare needs to present an interactive challenge. For most users, nothing will be visible at all.
2. Pass the app's current theme (`light` or `dark`) instead of `'auto'` so when the widget does appear, it matches the app theme.

## Changes

### 1. `src/components/auth/TurnstileWidget.tsx`

- Add `appearance: 'interaction-only'` to the render options. This hides the widget unless Cloudflare requires user interaction (rare). Most visitors will never see it.
- Add `appearance` to the `TurnstileOptions` type interface.
- Accept an optional `theme` prop so the parent can pass the resolved theme.
- Update the type to include the `appearance` option.

### 2. `src/components/auth/SignUpForm.tsx`

- Import `useTheme` from `@/contexts/ThemeContext`.
- Pass `theme={resolvedTheme}` to the `TurnstileWidget` component so it matches the app's current light/dark mode.

## What this achieves

- **For most users**: The widget will be completely invisible -- verification happens silently in the background, just like the sites you've seen.
- **For flagged users**: If Cloudflare needs interaction, the challenge widget appears styled to match the current theme (light or dark).
- **No dashboard changes needed**: This is purely a code-side improvement.

## Files Modified

| File | Change |
|---|---|
| `src/components/auth/TurnstileWidget.tsx` | Add `appearance: 'interaction-only'` option, accept `theme` prop |
| `src/components/auth/SignUpForm.tsx` | Pass `resolvedTheme` from `useTheme()` to TurnstileWidget |

