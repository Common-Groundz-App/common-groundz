

# Onboarding Modal Visual Polish

All changes are scoped to `src/components/profile/ProfileEditForm.tsx` only. No logic or validation changes.

## Changes

### 1. Shorter header with subtitle (onboarding only)

Replace the long "Almost there — complete your profile" with:
- Title: **"Complete your profile"**
- Subtitle: *"This helps others recognize and trust you on Common Groundz."* in muted, smaller text

In edit mode, the title stays "Edit Profile" with no subtitle.

### 2. Warning icon top-alignment and reduced intensity (onboarding: hidden entirely)

The 30-day cooldown warning (lines 337-340) is irrelevant during onboarding since the user is setting their username for the first time. Hide it when `isOnboarding` is true.

In edit mode, fix the icon alignment:
- Add `items-start` instead of the default center alignment on the flex container
- Reduce icon size from `h-3 w-3` to `h-3 w-3` (already small, keep it) but add `mt-0.5` to top-align with text
- Change text color from `text-amber-600` to `text-amber-500/80` for a softer, more informational tone

### 3. Asterisk micro-polish

Change the asterisk spans from:
```
<span className="text-destructive">*</span>
```
to:
```
<span className="text-destructive text-xs ml-0.5">*</span>
```

This makes them slightly smaller and adds a tiny left margin so they don't feel stuck to the label. Applied to all three required labels (First Name, Last Name, Username).

### 4. Button area spacing

Add a subtle top border and extra padding above the Continue button in onboarding mode by adding `className="pt-4 border-t"` to the `DialogFooter` when `isOnboarding` is true.

### 5. Hide 30-day warning during onboarding (bonus)

Since it's their first username, the "You can only change your username once every 30 days" warning adds unnecessary noise. Hide it when `isOnboarding` is true; show it only in edit mode.

## Technical Details

### File: `src/components/profile/ProfileEditForm.tsx`

**Lines 235-237** -- Header change:
```jsx
<DialogHeader>
  <DialogTitle>{isOnboarding ? 'Complete your profile' : 'Edit Profile'}</DialogTitle>
  {isOnboarding && (
    <p className="text-sm text-muted-foreground">
      This helps others recognize and trust you on Common Groundz.
    </p>
  )}
</DialogHeader>
```

**Lines 247, 261, 280** -- Asterisk polish (3 locations):
```jsx
<span className="text-destructive text-xs ml-0.5">*</span>
```

**Lines 337-340** -- Warning conditional + style fix:
```jsx
{!isOnboarding && (
  <p className="text-xs text-amber-500/80 flex items-start gap-1 mt-1">
    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
    You can only change your username once every 30 days. Your old username will be permanently retired.
  </p>
)}
```

**Line 380** -- Footer spacing:
```jsx
<DialogFooter className={isOnboarding ? 'pt-4 border-t' : ''}>
```

## Summary

| Area | Change |
|---|---|
| Header | Shorter title + subtitle in onboarding mode |
| Asterisks | Smaller size + slight left margin |
| Username warning | Hidden in onboarding; top-aligned + softer color in edit mode |
| Footer | Top border + padding in onboarding mode |

## What stays the same

- All validation logic unchanged
- Edit mode appearance unchanged (except warning icon alignment fix)
- No other files modified

