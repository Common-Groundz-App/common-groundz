
## Problem

When typing `@isha` and selecting an entity from the modal, the `@isha` text remains in the composer body. Entities become pills (not inline text), so the typed `@query` should be removed. The cleanup fails because the textarea loses focus when the modal opens, making the live cursor position unreliable.

## Fix

**File: `src/components/feed/EnhancedCreatePostForm.tsx`**

1. Add `atTriggerCursorRef = useRef<number | null>(null)` near existing refs.

2. In the `onChange` handler (~line 1042), save the cursor when `@` is detected:
   ```
   atTriggerCursorRef.current = cursorPos;
   ```

3. In `handleEntitiesChange` (~line 422), use the saved cursor instead of the live one:
   ```
   const liveCursor = atTriggerCursorRef.current ?? textareaRef.current?.selectionStart ?? cursorPosition.start;
   atTriggerCursorRef.current = null;
   ```

4. In `onMentionInsert` (~line 1437), same change for consistency:
   ```
   const liveCursor = atTriggerCursorRef.current ?? textareaRef.current?.selectionStart ?? cursorPosition.start;
   atTriggerCursorRef.current = null;
   ```

5. Reset the ref when modal closes without selection (~line 1427):
   ```
   atTriggerCursorRef.current = null;
   ```

Person mention behavior is unchanged -- people still insert as `@username` text. Only entities (pills) benefit from the cleanup fix.
