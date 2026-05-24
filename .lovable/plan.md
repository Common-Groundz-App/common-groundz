## Issue

`EnhancedCreatePostForm` is built as a full-page composer (`/create`), so its root has `min-h-[100dvh]` and the inner scroll surface has `pb-24` to clear the page's sticky bottom bar. When the same form is rendered inside the edit `Dialog` (capped at `max-h-[90vh] overflow-y-auto`), those rules force the content to fill the full viewport height inside the modal, producing the large empty area below the action row — and it grows even more when media is removed, because there is less content pushing against the forced 100dvh minimum.

## Fix

Make the two layout rules conditional on `isEditMode` so the dialog hugs its content while `/create` is unchanged.

**File:** `src/components/feed/EnhancedCreatePostForm.tsx`

1. Root wrapper (line ~1147): replace
   ```
   'flex flex-col min-h-[100dvh] bg-background transition-all'
   ```
   with
   ```
   'flex flex-col bg-background transition-all',
   !isEditMode && 'min-h-[100dvh]'
   ```

2. Inner scroll surface (line ~1162): change
   ```
   pt-3 md:pt-10 pb-2 md:pb-24
   ```
   to
   ```
   pt-3 md:pt-10 pb-2
   ```
   in edit mode (use `cn(..., isEditMode ? 'pb-2' : 'pb-2 md:pb-24')`). The `md:pb-24` exists only to clear the page-level sticky bottom bar on `/create`; in the dialog there is no such bar (the dialog uses the form's own buttons), so the padding is pure dead space.

No other files change. `/create` (create mode), `ComposerBottomBar`, `ComposerMediaPreview`, mobile layout, and feed rendering are all untouched.

## Verification

- Edit a post with 4 media → dialog hugs content, no whitespace under the action row.
- Remove all media → dialog shrinks instead of growing.
- Edit a post with 1 media → same compact behavior.
- Open `/create` (new post) on desktop and mobile → unchanged (still full-height, still has bottom-bar clearance).
