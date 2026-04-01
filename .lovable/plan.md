

# Fix: Comment Reply and Edit Failures (Final Version)

## Current State

- **`add_comment`** (lines 50-63): Uses `IF NOT FOUND` after `EXECUTE ... INTO` for parent validation — unreliable, causing "Parent comment not found or deleted" on valid replies
- **`update_comment`** (lines 33-35): Uses `IF NOT FOUND` after `EXECUTE` — unreliable, causing false return even when update succeeds
- Both already have `SET search_path = public` ✅
- `add_comment` already has auth guard ✅
- `update_comment` is missing auth guard ❌

## Changes — 1 migration file, 2 function updates

### 1. `add_comment` — replace `FOUND` with explicit boolean + COALESCE on is_deleted

Only the parent validation block (lines 50-63) changes:

```sql
-- Add to DECLARE:
  parent_found boolean := false;

-- Replace lines 50-63:
  IF p_parent_id IS NOT NULL THEN
    EXECUTE format('
      SELECT parent_id, true
      FROM %I
      WHERE id = $1 AND COALESCE(is_deleted, false) = false
      LIMIT 1
    ', comment_table)
    INTO parent_parent_id, parent_found
    USING p_parent_id;

    IF NOT COALESCE(parent_found, false) THEN
      RAISE EXCEPTION 'Parent comment not found or deleted';
    END IF;

    IF parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a reply (max 1 level of nesting)';
    END IF;
  END IF;
```

Everything else (auth guard, insert, mentions, notifications) stays identical.

### 2. `update_comment` — auth guard + UPDATE RETURNING + COALESCE on is_deleted

Full function replacement:

```sql
CREATE OR REPLACE FUNCTION public.update_comment(
  p_comment_id uuid, p_content text, p_user_id uuid, p_item_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_table text;
  did_update boolean;
BEGIN
  IF p_item_type NOT IN ('recommendation', 'post') THEN
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_item_type = 'recommendation' THEN
    comment_table := 'recommendation_comments';
  ELSE
    comment_table := 'post_comments';
  END IF;

  EXECUTE format('
    UPDATE %I
    SET content = $1, updated_at = now()
    WHERE id = $2 AND user_id = $3 AND COALESCE(is_deleted, false) = false
    RETURNING true
  ', comment_table)
  INTO did_update
  USING p_content, p_comment_id, p_user_id;

  RETURN COALESCE(did_update, false);
END;
$$;
```

### What's improved

| Issue | Fix |
|---|---|
| `FOUND` unreliable after `EXECUTE` | Replaced with explicit boolean / `RETURNING true` |
| `is_deleted` could be NULL | `COALESCE(is_deleted, false)` in all predicates |
| `update_comment` missing auth guard | Added `auth.uid()` check |
| Parent query edge cases | Added `LIMIT 1` for safety |
| `search_path` hardening | Already present on both functions ✅ |

### No frontend changes needed

Verified: `commentsService.ts` correctly passes all RPC params. `InlineCommentThread.tsx` correctly resolves `parentId` to top-level comment ID.

