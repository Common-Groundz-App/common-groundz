

# Hide Bottom Navigation for Guest Users on Public Pages

The bottom navigation is non-functional for guests — every item redirects to auth. Removing it for unauthenticated users makes public pages cleaner. The GuestNavBar already handles login/signup CTAs.

## Pages to Update

The following public-facing pages render `<BottomNavigation />` unconditionally (all already have `user` from `useAuth()`):

1. **EntityDetailV2.tsx** — 3 instances (lines 198, 211, 1096). Wrap each in `{user && <BottomNavigation />}`
2. **EntityDetail.tsx** — 3 instances (lines 241, 254, 1029). Same treatment.
3. **Profile.tsx** — 1 instance (line 57). Same treatment.

**UserProfile.tsx** is already correct — BottomNavigation only renders in the authenticated branch.

Pages like MyStuffPage, Feed, Settings, Search, etc. are auth-gated routes, so they don't need changes.

## Implementation

Each change is a single-line conditional: replace `<BottomNavigation />` with `{user && <BottomNavigation />}` in the three files listed above.

