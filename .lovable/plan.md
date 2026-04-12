

## Phase 3: Structured Experience Fields — Final Implementation Plan

This plan has been refined through multiple rounds of review. Both final suggestions are incorporated:

1. **DB CHECK constraint** — Ensure `structured_fields` is either `NULL` or a JSON object (not array/string/number)
2. **Analytics only when non-null** — Only fire `post_structured_fields_used` when `cleanStructuredFields()` returns non-null

---

### Step 1: Database Migration

```sql
-- Add the column
ALTER TABLE posts ADD COLUMN IF NOT EXISTS structured_fields jsonb DEFAULT NULL;

-- Ensure it's always null or a valid object
ALTER TABLE posts ADD CONSTRAINT structured_fields_is_object
CHECK (structured_fields IS NULL OR jsonb_typeof(structured_fields) = 'object');
```

No RLS changes needed — existing `posts` policies cover this column.

### Step 2: New File — `src/types/structuredFields.ts`

- `StructuredFields` interface with keys: `what_worked`, `what_didnt`, `duration`, `good_for`, `reuse_intent`, `_v`
- `DURATION_OPTIONS` map (enum codes → labels): `lt_1w`, `1_4w`, `1_3m`, `3_6m`, `6_12m`, `1y_plus`
- `ALLOWED_STRUCTURED_KEYS` whitelist for safe rendering
- `cleanStructuredFields(input)`:
  - Trims strings, collapses multiple spaces
  - Enforces max lengths (500 for narratives, 300 for `good_for`)
  - Preserves user casing (no lowercasing)
  - Validates `duration` and `reuse_intent` against allowed values
  - Maps legacy keys (`pros`→`what_worked`, `cons`→`what_didnt`, `best_for`→`good_for`)
  - Returns `null` if all fields empty (never stores `{"_v":1}` alone)
  - Adds `_v: 1` only when returning non-null
- `hasStructuredContent(data)` — boolean check, ignores `_v` key

### Step 3: Edit `EnhancedCreatePostForm.tsx`

- Add state for 5 structured fields
- Add Radix Collapsible section labeled "Add more about your experience", collapsed by default
- On expand: auto-focus "What worked" textarea
- Fields: two textareas with live character counters, one duration dropdown, one text input with counter, yes/no toggle ("Yes, I'd use it again" / "No, I wouldn't")
- Trim + collapse whitespace on blur (no casing changes)
- On submit:
  - Run `cleanStructuredFields()` 
  - If non-null: include as `structured_fields` in postData AND fire `analytics.track('post_structured_fields_used', { has_pros, has_cons, has_duration, has_good_for, has_reuse })`
  - If null: omit `structured_fields` from postData entirely (don't send the key at all)
- Reset all fields on success

### Step 4: Edit `PostContentViewer.tsx`

- Add `structured_fields` to Supabase select query
- Guard with `typeof === 'object'` + `hasStructuredContent()` check
- Only render keys from `ALLOWED_STRUCTURED_KEYS` (ignore unknown keys silently)
- Grouped display:
  - **Narrative** (top): "What worked" / "What didn't" with subtle icons (👍/👎)
  - **Metadata** (bottom): Duration, Good for, Would use again — inline row
- Only render fields that have values

### Files

| File | Action |
|------|--------|
| New migration SQL | Add column + CHECK constraint |
| `src/types/structuredFields.ts` | NEW — types, constants, cleaners |
| `src/components/feed/EnhancedCreatePostForm.tsx` | EDIT — collapsible section |
| `src/components/content/PostContentViewer.tsx` | EDIT — render structured fields |

### What stays unchanged
- Feed cards — no changes
- Heart/Like interaction — untouched
- Submit button stays "Post"
- All existing validation and submission logic preserved

