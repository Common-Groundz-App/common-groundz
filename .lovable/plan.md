
## Problem

When deleting text like `@rishab.devp` with backspace, once the content becomes `@rishab`, the `@` mention regex matches and opens the Entity Selector Modal. The modal steals focus, so subsequent backspaces edit the modal's search input instead of the textarea.

## Solution

Only trigger the `@` mention detection when the user is typing forward (content length increased), not when deleting (backspace). Targeted single-file fix.

## Technical Change

**`src/components/feed/EnhancedCreatePostForm.tsx`**:

1. Add a `prevContentLengthRef = useRef(content.length)` near the existing refs.
2. In the `<Textarea onChange>` handler (~line 1028), wrap the mention-trigger block (lines 1038-1044) with a guard: only run if `newContent.length > prevContentLengthRef.current`.
3. Update `prevContentLengthRef.current = newContent.length` at the end of the handler.

No changes to the modal, entity selector, tagging logic, or mention insertion logic.
