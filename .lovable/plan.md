

# Fix Comment System Bugs — Final Plan

## 3 Changes

### 1. Database Migration: Drop old `delete_comment` overload

Two overloads exist causing PGRST203:
- `(p_comment_id uuid, p_item_type text, p_user_id uuid)` — canonical, correct
- `(p_comment_id uuid, p_user_id uuid, p_item_type text)` — old, must go

Migration will:
- `DROP FUNCTION IF EXISTS public.delete_comment(uuid, uuid, text)` — removes old overload
- `CREATE OR REPLACE` the canonical function with auth guard added: `IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;`
- Already has `SECURITY DEFINER` and `SET search_path = public`
- `REVOKE ALL ON FUNCTION ... FROM anon, public; GRANT EXECUTE TO authenticated`

### 2. `CommentItem.tsx`: Strip leading @username from display content

When `replyToUsername` is set, strip the matching prefix from content before rendering to prevent visual duplication. Add null safety for `comment.content`.

```tsx
const content = comment.content || '';
const escUsername = replyToUsername?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const displayContent = replyToUsername
  ? content.replace(new RegExp(`^@${escUsername}\\b\\s*`, 'i'), '')
  : content;
```

Then use `<MentionText content={displayContent} />`.

### 3. `InlineCommentThread.tsx`: Harden auto-prepend logic

Replace loose `startsWith` check with escaped regex, scoped dedup, and empty-username fallback:

```tsx
if (parentComment.parent_id && parentComment.username) {
  const username = parentComment.username;
  if (!username || username.trim() === '') {
    finalContent = finalContent.trimStart();
  } else {
    const escUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    finalContent = finalContent.trimStart();
    const dupRegex = new RegExp(`^(@${escUser}\\s+)+`, 'i');
    finalContent = finalContent.replace(dupRegex, '').trimStart();
    const mentionRegex = new RegExp(`^@${escUser}\\b`, 'i');
    if (!mentionRegex.test(finalContent)) {
      finalContent = `@${username} ${finalContent}`;
    }
  }
}
```

## Files Modified

| File | Change |
|---|---|
| New migration SQL | Drop old `delete_comment(uuid, uuid, text)` overload, add auth guard, restrict to `authenticated` |
| `src/components/comments/CommentItem.tsx` | Strip leading `@username` from display + null safety |
| `src/components/comments/InlineCommentThread.tsx` | Escaped regex auto-prepend with scoped dedup and fallback |

