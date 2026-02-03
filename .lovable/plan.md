

# Add Turnstile Site Key to Environment

## Summary

Add the provided Cloudflare Turnstile Site Key to the `.env` file to enable the invisible CAPTCHA on the signup form.

## Change

**File: `.env`**

Update the empty `VITE_TURNSTILE_SITE_KEY` variable with your provided site key:

```
VITE_TURNSTILE_SITE_KEY="0x4AAAAAACXIGswZkNSoMIq2"
```

## What This Enables

Once added, the signup form will:
1. Load the Cloudflare Turnstile invisible widget
2. Automatically verify users in the background
3. Allow form submission once verification completes
4. Block automated bot signups

## Verification

After this change, test the signup flow:
1. Go to `/auth` and switch to Sign Up tab
2. Fill in all fields
3. The "Create Account" button should become enabled (Turnstile verifies invisibly)
4. Submit should route through the auth-gateway with the CAPTCHA token

