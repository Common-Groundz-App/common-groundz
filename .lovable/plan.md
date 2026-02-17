

# Fix: Record Slug History on Direct Slug Edits (Final)

## Problem

The `update_entity_slug()` trigger only records slug history on name/parent changes. Direct slug edits lose old slugs permanently, breaking old URLs.

## Solution

Restructure the trigger into three cases:

1. **Name/parent changed** -- save old slug to history, auto-generate new slug
2. **Slug changed directly to a valid value** -- save old slug to history, preserve user's new slug
3. **Slug cleared/emptied directly** -- save old slug to history, regenerate slug from current name

All history inserts guarded by `OLD.slug IS NOT NULL AND OLD.slug != ''`.

## Migration

Single SQL migration recreating `update_entity_slug()` with all existing hardening preserved:
- SECURITY DEFINER
- SET search_path = public, pg_temp
- REVOKE EXECUTE from anon and authenticated
- ON CONFLICT (entity_id, old_slug) DO NOTHING

No frontend changes. No edge function changes.

## Technical Detail

```text
-- Case 1: Name or parent changed -> record history + regenerate slug
IF (OLD.name IS DISTINCT FROM NEW.name) OR 
   (OLD.parent_id IS DISTINCT FROM NEW.parent_id) THEN
    IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
      INSERT INTO entity_slug_history (entity_id, old_slug)
        VALUES (NEW.id, OLD.slug)
        ON CONFLICT DO NOTHING;
    END IF;
    NEW.slug := generate_entity_slug(NEW.name, NEW.id);

-- Case 2: Slug changed directly to a valid value
ELSIF (OLD.slug IS DISTINCT FROM NEW.slug)
  AND NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
      INSERT INTO entity_slug_history (entity_id, old_slug)
        VALUES (NEW.id, OLD.slug)
        ON CONFLICT DO NOTHING;
    END IF;
    -- Preserve user's manually-set slug

-- Case 3: Slug cleared/emptied -> regenerate from name
ELSIF (NEW.slug IS NULL OR NEW.slug = '') THEN
    IF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
      INSERT INTO entity_slug_history (entity_id, old_slug)
        VALUES (NEW.id, OLD.slug)
        ON CONFLICT DO NOTHING;
    END IF;
    NEW.slug := generate_entity_slug(NEW.name, NEW.id);

END IF;
```

## What Changes vs Previous Plan

- Added defensive guard (`NEW.slug IS NOT NULL AND NEW.slug != ''`) on the direct-edit case (ChatGPT's suggestion)
- Added Case 3: if slug is cleared, regenerate from name instead of accepting empty slug
- Separated the empty-slug check from Case 1 into its own case for clarity

## Verification

1. Create entity "lion"
2. Rename to "lion1" -- `lion` appears in history, slug auto-generated
3. Manually change slug to "lion100" -- `lion1` appears in history, slug preserved
4. Clear the slug field -- `lion100` appears in history, slug regenerated from name
5. Visit `/entity/lion`, `/entity/lion1`, `/entity/lion100` -- all resolve to the entity

