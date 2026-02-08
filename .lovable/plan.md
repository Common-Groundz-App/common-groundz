

# Fix Turnstile Layout Gap and Button Grey-out

## Problems Identified

1. **Persistent gap**: The Turnstile container div always has an injected iframe child (even when invisible), so `[&:empty]:hidden` never activates. The div still takes up a slot in the `space-y-4` layout.

2. **Button grey-out on page load**: The "Create Account" button is disabled via `!turnstileToken` in the `disabled` prop. Since the Turnstile script takes a few seconds to load and return a token, the button appears greyed out initially, making the page feel unpolished.

## Regarding Supabase Captcha

Supabase's built-in captcha protection also uses Cloudflare Turnstile under the hood. Switching to it would not resolve these layout/UX issues and would require reworking the auth-gateway integration. Fixing the current implementation is the better path.

## Solution

### File: `src/components/auth/SignUpForm.tsx`

**Change 1 — Move TurnstileWidget outside `space-y-4`**

Move the TurnstileWidget out of the `CardContent` (which applies `space-y-4` gap) and place it between `CardContent` and `CardFooter` with no spacing classes. This way the invisible widget adds zero visual gap.

**Change 2 — Remove `!turnstileToken` from button disabled prop**

The token is already validated on submit (line 78 shows a toast if missing). Removing it from the `disabled` condition means the button is always orange/active from the start. If a user somehow clicks before the token arrives, they get a clear toast message. This eliminates the grey-out flicker entirely.

### No other files changed

| File | Change |
|---|---|
| `src/components/auth/SignUpForm.tsx` | Move TurnstileWidget outside `space-y-4` container; remove `!turnstileToken` from disabled prop |

