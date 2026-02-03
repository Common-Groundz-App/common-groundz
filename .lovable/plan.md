

# Phase 4: Rate Limiting + CAPTCHA for MVP Security

## Summary

Phase 4 adds two critical MVP security features:
1. **Rate Limiting** - Prevents brute force attacks on login, signup, and password reset
2. **CAPTCHA (Cloudflare Turnstile)** - Blocks automated signup bots

Both features protect the authentication endpoints where attacks have the highest impact.

---

## Why This Matters for MVP

| Threat | Without Protection | With Phase 4 |
|--------|-------------------|--------------|
| Brute force login | Attackers can try unlimited passwords | 5 attempts/minute, then blocked |
| Credential stuffing | Leaked password lists tested against your users | Rate limited + CAPTCHA stops automation |
| Signup spam bots | Fake accounts pollute trust graph | CAPTCHA blocks 99%+ of bots |
| Password reset abuse | Spam reset emails to any address | Rate limited to prevent harassment |

---

## Technology Choice: Cloudflare Turnstile

| Option | Pros | Cons |
|--------|------|------|
| **Cloudflare Turnstile** | Free, privacy-focused, invisible, no friction | Newer service |
| reCAPTCHA v3 | Proven, invisible | Google data collection, GDPR concerns |
| hCaptcha | Privacy-focused | Often requires user interaction |

**Decision: Cloudflare Turnstile**
- Free unlimited use
- Privacy-first (GDPR compliant)
- Invisible to users - no "click the traffic lights"
- Simple integration

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React)                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SignUpForm + Turnstile Widget (invisible)                  ││
│  │  SignInForm → auth-gateway                                  ││
│  │  ForgotPasswordForm → auth-gateway                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Function: auth-gateway                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  1. Check rate limit (IP + action)                          ││
│  │  2. Verify Turnstile token (signup only)                    ││
│  │  3. Forward to Supabase Auth                                ││
│  │  4. Record attempt in auth_rate_limits table                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase Auth                             │
│                 (signUp, signIn, resetPassword)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Setup Cloudflare Turnstile (Manual Step)

Before implementation, you'll need to:

1. Go to https://dash.cloudflare.com → Turnstile
2. Add a site for your domain (`common-groundz.lovable.app`)
3. Choose "Invisible" widget type
4. Copy the **Site Key** (public) and **Secret Key** (private)

**Add to Lovable Secrets:**
- `TURNSTILE_SECRET_KEY` - Secret key for edge function verification

**Add to Environment:**
- `VITE_TURNSTILE_SITE_KEY` - Site key for frontend widget

---

### Step 2: Create Rate Limit Table

**New Database Migration:**

Creates a table to track authentication attempts by IP address:

```sql
-- Phase 4: Rate limiting for auth endpoints
CREATE TABLE public.auth_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,           -- IP address
    action text NOT NULL,               -- 'login', 'signup', 'password_reset', 'resend_verification'
    attempt_count int DEFAULT 1,
    window_start timestamptz DEFAULT now(),
    blocked_until timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE (identifier, action)
);

-- RLS enabled but service role can access
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Fast lookup index
CREATE INDEX idx_auth_rate_limits_lookup 
ON public.auth_rate_limits (identifier, action, window_start);

-- Cleanup function for old records (can be scheduled)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM public.auth_rate_limits 
  WHERE window_start < now() - interval '1 hour';
$$;

COMMENT ON TABLE public.auth_rate_limits IS 
'Phase 4: Tracks auth attempts for rate limiting. Cleaned up hourly.';
```

---

### Step 3: Create Auth Gateway Edge Function

**New File: `supabase/functions/auth-gateway/index.ts`**

A unified edge function that:
- Checks rate limits before processing requests
- Verifies Turnstile tokens on signup
- Forwards valid requests to Supabase Auth
- Returns user-friendly error messages when blocked

**Rate Limit Configuration:**

| Action | Max Attempts | Window | Block Duration |
|--------|-------------|--------|----------------|
| Login | 5 per minute | 60s | 5 minutes |
| Signup | 3 per 5 min | 300s | 15 minutes |
| Password Reset | 3 per 5 min | 300s | 10 minutes |
| Resend Verification | 2 per minute | 60s | 5 minutes |

---

### Step 4: Create Turnstile React Component

**New File: `src/components/auth/TurnstileWidget.tsx`**

A React component that:
- Loads Cloudflare Turnstile script
- Renders an invisible CAPTCHA widget
- Returns a verification token on success
- Calls error/expire callbacks as needed

---

### Step 5: Update SignUpForm

**Modified: `src/components/auth/SignUpForm.tsx`**

Changes:
- Add TurnstileWidget component
- Store Turnstile token in state
- Route signup through auth-gateway edge function
- Validate CAPTCHA token before submission
- Display appropriate errors for rate limiting

---

### Step 6: Update SignInForm

**Modified: `src/components/auth/SignInForm.tsx`**

Changes:
- Route login through auth-gateway edge function
- Handle 429 (rate limited) responses
- Display retry countdown when blocked

---

### Step 7: Update ForgotPasswordForm

**Modified: `src/components/auth/ForgotPasswordForm.tsx`**

Changes:
- Route password reset through auth-gateway edge function
- Handle 429 responses with user-friendly messaging

---

### Step 8: Update AuthContext

**Modified: `src/contexts/AuthContext.tsx`**

Changes:
- Update `resendVerificationEmail` to use auth-gateway
- Add utility function for calling auth-gateway endpoint

---

### Step 9: Update Configuration

**Modified: `src/config/authConfig.ts`**

Add Phase 4 documentation and rate limit reference configuration.

---

## Files Summary

| File | Type | Purpose |
|------|------|---------|
| Database Migration | NEW | `auth_rate_limits` table |
| `supabase/functions/auth-gateway/index.ts` | NEW | Rate limiting + CAPTCHA verification |
| `src/components/auth/TurnstileWidget.tsx` | NEW | Cloudflare Turnstile React wrapper |
| `src/components/auth/SignUpForm.tsx` | UPDATE | Add Turnstile, use gateway |
| `src/components/auth/SignInForm.tsx` | UPDATE | Use gateway for rate limiting |
| `src/components/auth/ForgotPasswordForm.tsx` | UPDATE | Use gateway for rate limiting |
| `src/contexts/AuthContext.tsx` | UPDATE | Use gateway for resend verification |
| `src/config/authConfig.ts` | UPDATE | Document Phase 4 completion |

**Total: 3 new files, 5 updated files, 2 new secrets**

---

## Setup Requirements Before Implementation

1. **Cloudflare Turnstile Account**
   - Create at https://dash.cloudflare.com → Turnstile
   - Add site with "Invisible" widget type
   
2. **Add Secret to Lovable**
   - `TURNSTILE_SECRET_KEY` → your secret key

3. **Add Environment Variable**
   - `VITE_TURNSTILE_SITE_KEY` → your site key

---

## What This Does NOT Break

| Concern | Status |
|---------|--------|
| Existing authenticated sessions | ✅ Unaffected |
| Normal user login flow | ✅ Works, just routed through gateway |
| Verified users' actions | ✅ No change to Phase 2/3 behavior |
| Direct Supabase API calls | ✅ Still work (auth is only gated via forms) |

---

## Testing Checklist

### Rate Limiting
1. Try 6 failed logins quickly → blocked for 5 minutes
2. Wait, then retry → works again
3. Signup 4 times quickly → blocked for 15 minutes
4. Password reset 4 times quickly → blocked for 10 minutes

### CAPTCHA
1. Turnstile widget loads invisibly on signup page
2. Signup works when Turnstile verifies successfully
3. Signup fails gracefully if CAPTCHA blocked
4. No CAPTCHA friction for normal users

---

## Rollback Plan

If issues occur after deployment:

**Quick fix - Disable gateway routing:**
- Revert auth forms to call Supabase directly
- Gateway remains deployed but unused

**Full rollback:**
- Revert all form changes
- Delete auth-gateway edge function
- Drop auth_rate_limits table

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| IP spoofing | Using trusted x-forwarded-for from Supabase edge |
| Token replay | Turnstile tokens are single-use |
| Rate limit bypass | Server-side enforcement, cannot bypass from client |
| Blocking legitimate users | Generous limits, clear retry-after messaging |

---

## Phase 4 Completion Status (After Implementation)

| Feature | Status |
|---------|--------|
| Password strength validation | ✅ Phase 1 |
| Email verification flow | ✅ Phase 1 |
| Forgot password flow | ✅ Phase 1 |
| UI restrictions for unverified users | ✅ Phase 2 |
| RLS enforcement for email verification | ✅ Phase 3 |
| Rate limiting on auth endpoints | 📋 Phase 4 |
| CAPTCHA on signup | 📋 Phase 4 |

---

## Deferred to Phase 5+

| Feature | Status |
|---------|--------|
| Magic Link / OTP login | Deferred (convenience, not security) |
| Social Logins | Deferred (growth feature, adds complexity) |
| CAPTCHA on login | Add only if brute force attacks observed |
| Geographic rate limiting | Premature optimization |

