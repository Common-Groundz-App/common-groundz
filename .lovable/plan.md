

# Hide Close Button + Update Header in Onboarding Mode

## Changes

### 1. `src/components/ui/dialog.tsx` -- Add `hideCloseButton` prop to `DialogContent`

Add an optional `hideCloseButton` boolean prop. When true, the `DialogPrimitive.Close` button (the X icon) is not rendered. This keeps the component reusable -- all existing dialogs are unaffected.

### 2. `src/components/profile/ProfileEditForm.tsx` -- Two small changes (onboarding only)

- Pass `hideCloseButton` to `DialogContent` when `isOnboarding` is true
- Change the `DialogTitle` text from `"Complete Your Profile"` to `"Almost there — complete your profile"` when in onboarding mode

No other files or components are affected.

## Technical Details

### dialog.tsx

```text
// Add hideCloseButton to the props interface
interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
}

// Conditionally render the close button
{!hideCloseButton && (
  <DialogPrimitive.Close className="absolute right-4 top-4 ...">
    <X className="h-4 w-4" />
    <span className="sr-only">Close</span>
  </DialogPrimitive.Close>
)}
```

### ProfileEditForm.tsx

Line 232: Add `hideCloseButton={isOnboarding}`
Line 234: Change title to `isOnboarding ? 'Almost there — complete your profile' : 'Edit Profile'`

## Files Modified

| File | Change |
|---|---|
| `src/components/ui/dialog.tsx` | Add optional `hideCloseButton` prop to `DialogContent` |
| `src/components/profile/ProfileEditForm.tsx` | Pass `hideCloseButton` in onboarding mode; update onboarding title text |

