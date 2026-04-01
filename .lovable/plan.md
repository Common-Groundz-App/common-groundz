

# Fix: Drop duplicate `add_comment` function overload

## Root Cause

The Phase 3 migration used `CREATE OR REPLACE FUNCTION` which created a **new** 5-parameter version of `add_comment` (with `p_parent_id uuid DEFAULT NULL`), but the **old** 4-parameter version (without `p_parent_id`) was never dropped. PostgreSQL sees two candidate functions and throws:

> "Could not choose the best candidate function between..."

## Fix

One migration that drops the old 4-parameter overload:

```sql
DROP FUNCTION IF EXISTS public.add_comment(uuid, text, text, uuid);
```

This leaves only the new 5-parameter version (which has `p_parent_id DEFAULT NULL`, so calls without that argument still work).

## Files Modified

- **1 new migration file** — single `DROP FUNCTION` statement. No frontend changes needed.

