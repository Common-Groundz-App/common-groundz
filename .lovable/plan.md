

# Final Plan: Two-Button Sign-In with Refinements

Both ChatGPT suggestions are correct and worth adopting:

1. **Smooth transition** — use `animate-fade-in` (already available in the project) when the email form appears, instead of an instant swap.
2. **No ring highlight on the expanded form** — only highlight the "Continue with Email" *button* in the initial view. Once the form expands, show a clean form with no ring/badge.

One additional improvement I'd add:

3. **"← Back to all sign in options" as a subtle link, not a button** — use a small `text-sm text-muted-foreground hover:text-foreground` link with an arrow icon, positioned below the Sign In button. This keeps the form clean and doesn't compete visually with the primary action.

## Changes: `src/components/auth/SignInForm.tsx`

- Add `showEmailForm` state (default `false`)
- **Initial view** (`!showEmailForm`):
  - Google button (with Last used badge if `lastMethod === 'google'`)
  - "Continue with Email" outline button with `MailIcon` (with Last used badge + ring if `lastMethod === 'email'`)
  - No separator, no input fields
- **Email form view** (`showEmailForm`):
  - Hide Google button
  - Show email input, password input, forgot password link, Sign In button — all visible, no progressive disclosure
  - Auto-focus email input
  - No ring highlight or badge on the form itself
  - "← Back to all sign in options" subtle link at bottom
  - Wrap in `animate-fade-in` for smooth entrance

## No changes needed
- `GoogleSignInButton.tsx` — already has floating badge + ring support

## Files changed
- `src/components/auth/SignInForm.tsx`

