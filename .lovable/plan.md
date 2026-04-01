

# Fix: Harden add_comment and toggle_comment_like RPCs

## What and Why

Two small but meaningful improvements to the already-deployed Phase 3 SQL:

1. **Auth guard** — Both `add_comment` and `toggle_comment_like` are `SECURITY DEFINER` functions. Without validating `auth.uid() = p_user_id`, a malicious client could call the RPC with someone else's user_id. Add a check at the top of both functions.

2. **Optimize reply notification check** — Replace the `SELECT unnest(ARRAY(SELECT ...))` pattern with a simpler `NOT EXISTS` subquery for checking if the parent author was already mentioned.

## Migration SQL

Single migration with `CREATE OR REPLACE FUNCTION` for both RPCs. Changes are minimal:

### `add_comment` changes:
- Add after item type validation:
  ```sql
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  ```
- Replace the reply notification's array-based mention check:
  ```sql
  -- OLD:
  AND NOT (parent_author_id = ANY(SELECT unnest(ARRAY(SELECT cm.mentioned_user_id ...))))
  -- NEW:
  AND NOT EXISTS (
    SELECT 1 FROM public.comment_mentions cm
    WHERE cm.comment_id = new_comment_id
      AND cm.comment_type = p_item_type
      AND cm.mentioned_user_id = parent_author_id
  )
  ```

### `toggle_comment_like` changes:
- Add after comment type validation:
  ```sql
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  ```

## Files Modified

- **1 migration file** (SQL only) — no frontend changes needed

