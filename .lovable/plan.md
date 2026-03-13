

# Fix: AuthPromptModal z-index for nested dialog stacking

## What's happening
The `AuthPromptModal` uses `AlertDialogContent` which renders overlay and content at `z-50`. The `CommentDialog` is at `z-[101]`. So the auth modal opens *behind* the comment dialog — darkening the screen but invisible and trapping focus.

## Fix (1 file)

**`src/components/auth/AuthPromptModal.tsx`**

Replace the `AlertDialogContent` import with the lower-level primitives (`AlertDialogPortal`, `AlertDialogOverlay`) and manually compose them with elevated z-indexes:

- Import `AlertDialogPortal`, `AlertDialogOverlay` alongside existing imports
- Replace `<AlertDialogContent className="...">` with:
  ```tsx
  <AlertDialogPortal>
    <AlertDialogOverlay className="fixed inset-0 z-[109] bg-black/50 ..." />
    <div className="fixed left-[50%] top-[50%] z-[110] ... (same animation/positioning classes as AlertDialogContent)" role="alertdialog">
  ```
  Wait — actually simpler: just keep `AlertDialogContent` but pass explicit z-index classes to both the overlay and content. Looking at `alert-dialog.tsx`, the `AlertDialogContent` component internally renders `AlertDialogOverlay` with no way to pass it a custom className.

  So the correct approach: **stop using the compound `AlertDialogContent`** and manually compose the portal:

```tsx
import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
```

Then in the JSX, replace line 83-138 with:
```tsx
<AlertDialogPortal>
  <AlertDialogOverlay className="z-[109]" />
  <AlertDialogPrimitive.Content
    className="fixed left-[50%] top-[50%] z-[110] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg w-[90vw] p-0 gap-0 overflow-hidden"
  >
    {/* ... all existing children unchanged ... */}
  </AlertDialogPrimitive.Content>
</AlertDialogPortal>
```

This preserves all accessibility attributes (Radix's `AlertDialogPrimitive.Content` handles `role="alertdialog"`, focus trap, etc.) and all animation classes from the original `AlertDialogContent`, while elevating both overlay and content above any other dialog.

## Regarding ChatGPT's z-index constants suggestion
Nice idea in theory but premature — there are only 3 dialog layers today. Not worth adding abstraction now; a comment documenting the hierarchy is sufficient.

## Regarding Codex's accessibility note
Valid — using `AlertDialogPrimitive.Content` (not a raw `div`) preserves all Radix accessibility and focus-trap behavior. The animation classes are copied from the existing `AlertDialogContent` component. No regression.

