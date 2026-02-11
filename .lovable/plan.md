

# Final Plan: Account Deleted Restyle, Onboarding Fix, and Blank Screen Bug

## 1. Restyle `/account-deleted` page

**File: `src/pages/AccountDeleted.tsx`**

- Remove standalone `Logo`, add `NavBarComponent` at top and `Footer` at bottom
- Wrap content in `main` with `container mx-auto px-4 py-12 max-w-4xl` (matching policy pages)
- Keep structured card-based content (recovery card, OAuth warning, action buttons)
- Add a "copy email" fallback button next to the mailto link with graceful error handling:
  - On success: toast "Email copied to clipboard"
  - On failure: toast "Couldn't copy. Please email support@commongroundz.co manually"

## 2. Fix onboarding flow and blank screen bug

**File: `src/components/profile/ProfileEditForm.tsx`**

Three changes in `onSubmit`:

1. **Skip toast in onboarding**: Wrap toast in `if (!isOnboarding)`
2. **Await cache invalidation with Promise.all before navigation**:
```typescript
if (isOnboarding) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['profile-completion-check'] }),
    queryClient.invalidateQueries({ queryKey: ['profile-for-completion'] }),
  ]);
  navigate('/home', { replace: true });
} else {
  onClose();
}
```
3. **Import `useQueryClient`** from `@tanstack/react-query`

## Files Modified

| File | Change |
|---|---|
| `src/pages/AccountDeleted.tsx` | NavBarComponent + Footer + container layout; copy-email fallback with error handling |
| `src/components/profile/ProfileEditForm.tsx` | Skip toast in onboarding; `Promise.all` cache invalidation before navigate |

No new files. No changes to `CompleteProfile.tsx` or `RequireCompleteProfile.tsx`.

