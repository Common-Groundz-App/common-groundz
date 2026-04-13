

## Phase 4: Post Type Labels — Final Implementation Plan

All feedback rounds incorporated. Ready to implement.

### Refinements from latest review (both adopted)

1. **Backfill NULL post_type** — add `UPDATE posts SET post_type = 'story' WHERE post_type IS NULL;` in migration
2. **Placeholder reset** — explicitly reset to base text when toggling back to Experience
3. **Chip styling** — `text-xs`, outline/ghost variant, muted colors, visually secondary
4. **Badge resilience** — null/unknown types render no badge, never crash

### Implementation

**Step 1: Database Migration**
```sql
-- Forward-only enum additions
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'comparison';
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'question';
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'tip';
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'update';

-- DB-level default
ALTER TABLE posts ALTER COLUMN post_type SET DEFAULT 'story';

-- Backfill any NULLs
UPDATE posts SET post_type = 'story' WHERE post_type IS NULL;
```

**Step 2: `src/components/feed/utils/postUtils.ts`**
- Expand `DatabasePostType`: add `'comparison' | 'question' | 'tip' | 'update'`
- Keep legacy mappings
- Update `getPostTypeLabel()` with new labels
- Add `POST_TYPE_OPTIONS` array: `[{value, label, placeholder}]`
- Add `shouldShowTypeBadge(type)`: whitelist check — `['comparison','question','tip','update'].includes(type)`
- Add `getPlaceholderForType(type)`: returns subtle suffixes, defaults to "Share your experience..."

**Step 3: `EnhancedCreatePostForm.tsx` (create flow only)**
- Add `postType` state, default `'story'`
- Horizontal chip selector below title (text-xs, outline style, muted)
- Toggle-off: clicking selected chip resets to `'story'` AND resets placeholder to base text
- Submit: `post_type: postType || 'story'`
- Analytics: track `post_type_selected` on submit when non-default
- Reset on success

**Step 4: Edit form type-safety (no UI)**
- `ModernCreatePostForm.tsx`: expand zod enum and type unions to accept new values
- `CreatePostForm.tsx`: expand zod enum to accept new values
- No chip UI added — prevents validation errors when editing typed posts

**Step 5: `PostFeedItem.tsx` — feed badge**
- Show small muted outline Badge next to date when `shouldShowTypeBadge` returns true
- Null/unknown: no badge, no crash

**Step 6: `PostContentViewer.tsx` — detail badge**
- Same badge logic for consistency

**Step 7: Type files**
- `src/integrations/supabase/types.ts`: expand enum union
- `src/hooks/feed/types.ts`: expand `post_type` in PostFeedItem interface

### Files

| File | Action |
|------|--------|
| New migration SQL | Enum values + default + backfill |
| `postUtils.ts` | Types, labels, helpers |
| `EnhancedCreatePostForm.tsx` | Chip selector UI |
| `ModernCreatePostForm.tsx` | Zod/type safety only |
| `CreatePostForm.tsx` | Zod/type safety only |
| `PostFeedItem.tsx` | Type badge |
| `PostContentViewer.tsx` | Type badge |
| `supabase/types.ts` | Enum update |
| `hooks/feed/types.ts` | Union update |

### Unchanged
- Structured fields (Phase 3) — independent
- Hearts/interaction — untouched
- Feed layout — minimal addition (small muted badge)
- Edit form UI — no chips added

