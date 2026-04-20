

## Verdict: Not a bug — two separate real issues stacked. Both fixable, both worth fixing.

### What actually happened (root causes)

**Error 1: "Email address is invalid"**
Comes from Supabase Auth, not your code. Supabase runs server-side email validation that can reject addresses for reasons beyond format:
- Internal reputation/blocklist (likely hit here — `sheldoncooper@gmail.com` is a famous fictional name often used by spammers/testers, may be on a shared blocklist)
- Previous bounce history
- Email provider rejection signals

**Deleting the Supabase user does NOT clear this** — the validation is on the email string itself, not tied to your `auth.users` row. That's why re-trying with the same email failed identically.

**Error 2: "Security verification failed. Please refresh and try again."**
This is the **real bug worth fixing.** Turnstile tokens are **single-use** — once submitted to the server (even if the signup itself fails), the token is spent. On retry, the form sent the same already-consumed token, and Cloudflare rejected it.

Looking at `SignUpForm.tsx`: when signup fails (any reason — invalid email, USER_EXISTS, network, etc.), we **never reset the Turnstile widget**. The stale token sits in state until expiry (~5 min), and every retry fails CAPTCHA verification.

This is exactly why the error *changed* between attempt 1 and attempt 2 — attempt 1 used a fresh token (CAPTCHA passed, Supabase rejected the email); attempt 2 reused the spent token (CAPTCHA failed before Supabase was even called).

### Is this how the big guys do it?

Partly. The deletion-doesn't-clear-the-blocklist behavior is standard (Stripe, Auth0, Clerk all do this — email reputation is global, not per-tenant). But professional apps **always reset CAPTCHA on failed submit**. That's the missing piece.

### The fix (minimal, two changes in `src/components/auth/SignUpForm.tsx`)

**Change 1: Expose a `reset()` method on TurnstileWidget**

In `src/components/auth/TurnstileWidget.tsx`, wrap with `forwardRef` and expose:
```ts
useImperativeHandle(ref, () => ({
  reset: () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }
}));
```

**Change 2: Reset the widget after every failed signup attempt**

In `SignUpForm.tsx`:
- Add `const turnstileRef = useRef<{ reset: () => void }>(null);`
- Pass `ref={turnstileRef}` to `<TurnstileWidget />`
- In every `if (result.error)` branch and the `catch` block, call:
  ```ts
  setTurnstileToken(null);
  turnstileRef.current?.reset();
  ```

This guarantees: failed signup → fresh CAPTCHA token → next attempt has a real shot.

**Change 3: Friendlier error message for the email-invalid case**

When the gateway returns Supabase's "Email address ... is invalid" error, show a clearer message:
> *"This email address can't be used. Please try a different email, or contact support if you believe this is a mistake."*

Detect via the error message string in the existing catch block. One small `if` branch.

### What I'm NOT changing
- Not bypassing or disabling Supabase's email validation (it's a security feature, blocks real spam)
- Not adding email pre-validation on the client (would just duplicate Supabase's check inconsistently)
- Not touching the gateway, rate limits, or any other auth flow
- Not adding "delete user fully" admin tooling — for testing, just use a different email; for real users, the existing flow works once they pick a non-flagged address

### Verification
1. Try signup with a flagged/test email → see friendlier "can't be used" message
2. Without refreshing, change to a real email → click Create Account → should succeed (no more "Security verification failed")
3. Try a wrong-format password → fix it → retry → should succeed (CAPTCHA reset works for any failure path)
4. Confirm successful signup with a fresh real email still works end-to-end
5. Confirm Turnstile still loads and verifies on first attempt (no regression)

