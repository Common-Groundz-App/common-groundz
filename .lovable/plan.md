

# Fix: Prevent Slug Collisions with Slug History (Updated)

## Problem

When generating new slugs, the system only checks the `entities` table for uniqueness. It does not check `entity_slug_history`. A new entity can receive a slug previously used by another entity, silently breaking old URL redirects.

## Solution

Single SQL migration with three changes:

### 1. Add standalone index on `old_slug`

The existing unique index is `(entity_id, old_slug)` -- composite. Slug generation queries `WHERE old_slug = X` without an `entity_id` filter, so that composite index does not help. A standalone index is needed for performance.

```text
CREATE INDEX IF NOT EXISTS idx_entity_slug_history_old_slug
ON entity_slug_history (old_slug);
```

### 2. Update `generate_entity_slug(name, entity_id)`

Inside the uniqueness loop, after checking `entities.slug`, add a second check against `entity_slug_history`:

```text
IF NOT slug_exists THEN
  SELECT EXISTS(
    SELECT 1 FROM entity_slug_history
    WHERE old_slug = final_slug AND entity_id != current_entity_id
  ) INTO slug_exists;
END IF;
```

The `entity_id != current_entity_id` guard allows an entity to reclaim its own previous slug (e.g., reverting a rename).

### 3. Update `generate_entity_slug_on_insert()`

Same history check added to the INSERT trigger's uniqueness loop:

```text
IF NOT slug_exists THEN
  SELECT EXISTS(
    SELECT 1 FROM entity_slug_history
    WHERE old_slug = final_slug
  ) INTO slug_exists;
END IF;
```

No entity_id exclusion needed here since new entities have no history.

## What Does NOT Change

- The `update_entity_slug()` trigger (already correct from previous migration)
- The `entity_slug_history` table structure
- Frontend code
- Edge functions
- RLS policies

## On the DB-Level Constraint Suggestion

ChatGPT suggested a cross-table unique constraint. PostgreSQL does not support this natively. The alternatives (materialized views, shadow tables) add significant complexity. The trigger-based approach is sufficient because:

- All slug generation is funneled through these two `SECURITY DEFINER` functions
- Execute is revoked from `anon` and `authenticated` roles
- Direct SQL writes to `entities` are admin-only operations

If needed in the future, a `BEFORE INSERT OR UPDATE` trigger on `entities` could reject any slug found in history as a final safety net.

## On the "Resolve Old Slugs During Fetch" Suggestion

This is the separate redirect fix already planned and approved. It is a frontend change (updating `fetchEntityBySlug` to check history before returning "not found") and is independent of this migration.

## Verification

1. Create entity "Lion" (gets slug `lion`)
2. Rename to "Tiger" -- `lion` goes to history, slug becomes `tiger`
3. Create a new entity "Lion" -- should get `lion-1` (not `lion`, because `lion` is reserved in history)
4. Visit `/entity/lion` -- should still redirect to the original entity ("Tiger") once the frontend redirect fix is also implemented
5. Rename "Tiger" back to "Lion" -- should reclaim slug `lion` (self-exclusion guard)

