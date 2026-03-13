

# Fix: Always block guest typing in comment textarea

## Changes — `src/components/comments/CommentDialog.tsx`

ChatGPT's ref suggestion is valid — using a ref is cleaner than `document.activeElement`. However, the component uses `<Textarea>` (a shadcn component), not a raw `<textarea>`, so we need to check if it forwards refs properly. Shadcn's Textarea uses `React.forwardRef`, so a ref will work fine.

### Edits:

1. **Add** `textareaRef`:
   ```tsx
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   ```

2. **Remove** `hasPromptedRef` declaration and its reset in useEffect

3. **Attach ref** to the comment Textarea:
   ```tsx
   <Textarea ref={textareaRef} ... />
   ```

4. **Update** `onFocus` handler:
   ```tsx
   onFocus={() => {
     if (!user) {
       setNewComment('');
       requireAuth({ action: 'comment', surface: 'comment_dialog' });
       textareaRef.current?.blur();
     }
   }}
   ```

Four small surgical edits, one file. Clean and reliable across browsers.

