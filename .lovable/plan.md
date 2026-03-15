

# Final Plan: "Last Used" Badge UI Refinement

Both ChatGPT suggestions are good. Here's the refined plan incorporating them:

## Changes

### 1. `src/components/auth/GoogleSignInButton.tsx`
- Wrap button in `<div className="relative">` container
- When `showLastUsed`: add `ring-2 ring-brand-orange ring-offset-2` to the button
- Move badge **outside** the button as absolutely positioned element: `absolute -top-3 -right-3 z-10`
- Badge styling: **`bg-brand-orange text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm`** (ChatGPT's refinement — orange bg is more visible on white card)
- Remove the inline badge from inside the button text
- Add subtle `animate-scale-in` entrance animation instead of bounce

### 2. `src/components/auth/SignInForm.tsx`
- **Reorder layout**: Google button → separator → email form (Google on top)
- **Progressive disclosure**: hide password field + Sign In button until `email.length > 0`
- **Remove "Last used" badge from Sign In button entirely**
- When `lastMethod === 'email'`: wrap email section in `relative` container with `ring-2 ring-brand-orange ring-offset-2 rounded-lg p-4`, place corner badge at `absolute -top-3 -right-3 z-10` with same `bg-brand-orange text-white` styling
- **Auto-focus**: if `lastMethod === 'email'`, auto-focus email input via ref

### Layout result

```text
┌─────────────────────────────────┐
│        Welcome Back!            │
│                                 │
│  ┌───────────────────────┐      │
│  │ Continue with Google  │ [Last used]  ← floating corner badge
│  └───────────────────────┘      │
│     ring-2 ring-brand-orange    │
│                                 │
│  ──── Or continue with ─────   │
│                                 │
│  Email                          │
│  [ your@email.com           ]   │
│                                 │
│  (password + sign in appear     │
│   after typing email)           │
└─────────────────────────────────┘
```

## Files changed
- `src/components/auth/GoogleSignInButton.tsx`
- `src/components/auth/SignInForm.tsx`

