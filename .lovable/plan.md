

# Add Log Out Button to Account Settings

## Problem
No simple "Log Out" option exists in the Account tab. Users may confuse "Logout from all devices" (global sign-out) with a regular logout, or worse, click "Delete Account" when they just want to sign out.

## Change

**File**: `src/pages/Settings.tsx`

Add a "Log Out" section as the last item in the Account Settings card, after "Active Sessions" and before the Danger Zone card:

```tsx
<Separator />

<div>
  <h3 className="text-lg font-medium flex items-center gap-2">
    <LogOut className="h-4 w-4" />
    Log Out
  </h3>
  <p className="text-sm text-muted-foreground mb-2">
    Sign out of your account on this device.
  </p>
  <Button variant="outline" size="sm" onClick={signOut}>
    Log Out
  </Button>
</div>
```

This uses the existing `signOut` from `useAuth()` which is already destructured at the top of the component. The `LogOut` icon is already imported.

**Order in Account Settings card becomes:**
1. Email (with verification status)
2. Password (change password) — conditional on non-OAuth users
3. Active Sessions (logout from all devices) — the "nuclear" option
4. **Log Out** (simple, single-device sign out) — the common action
5. *(visual gap)* → Danger Zone card (Delete Account)

This ensures the most common action (log out) is easily accessible and clearly separated from the destructive action (delete account).

