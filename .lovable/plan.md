
# Post Type Consolidation — Clean `experience` Enum

Replace the current 8-value DB enum + 2 UI-only types with exactly 6 values: `experience` (default), `review`, `recommendation`, `comparison`, `question`, `tip`.

---

## Step 1: Database Migration

A single migration that:

1. Migrates all legacy post rows to `story` (the only common existing value before enum swap):
   - `UPDATE posts SET post_type = 'story' WHERE post_type IN ('routine','project','note','update');`

2. Creates new enum `post_type_new` with: `experience`, `review`, `recommendation`, `comparison`, `question`, `tip`

3. Alters `posts.post_type`:
   - Drop default
   - Change column type to `text`
   - Update `story` -> `experience`
   - Cast column to `post_type_new`
   - Set default to `experience`

4. Drops old `post_type` enum, renames `post_type_new` to `post_type`

5. Also strips `ui_post_type` from any existing `structured_fields` JSONB

---

## Step 2: Update `src/components/feed/utils/postUtils.ts`

- `DatabasePostType` = `'experience' | 'review' | 'recommendation' | 'comparison' | 'question' | 'tip'`
- Remove `UIPostType` export entirely
- Remove `mapPostTypeToDatabase` function
- Update `POST_TYPE_OPTIONS` to 5 chips: Review, Recommendation, Comparison, Question, Tip
- Update `getPostTypeLabel` — experience/review/recommendation/comparison/question/tip only
- Update `BADGE_TYPES` — `['review', 'recommendation', 'comparison', 'question', 'tip']`
- Update `getPlaceholderForType` default fallback

---

## Step 3: Update Type Definitions (4 files)

| File | Change |
|------|--------|
| `src/hooks/feed/types.ts` line 30 | `post_type: 'experience' \| 'review' \| 'recommendation' \| 'comparison' \| 'question' \| 'tip'` |
| `src/types/entities.ts` line 66 | Same 6-value union |
| `src/components/profile/services/profilePostsService.ts` line 11 | Same 6-value union |
| `src/components/profile/ProfilePostItem.tsx` line 50 | Same 6-value union |

---

## Step 4: Update `src/types/structuredFields.ts`

- Remove `ui_post_type` from `StructuredFields` interface
- Remove `'ui_post_type'` from `ALLOWED_STRUCTURED_KEYS`
- Remove `VALID_UI_POST_TYPES` constant
- Remove `ui_post_type` validation block in `cleanStructuredFields`

---

## Step 5: Update Composer (`EnhancedCreatePostForm.tsx`)

- Replace all `UIPostType` with `DatabasePostType`
- Remove `mapPostTypeToDatabase` import
- Change default from `'story'` to `'experience'`
- Remove `hydratedUiType` / `ui_post_type` hydration logic
- Remove `journal`/`watching` branch in structured_fields merge
- Remove `ui_post_type` stripping logic
- Use `postType` directly instead of `dbPostType` mapping

---

## Step 6: Update Composer Sub-components (3 files)

| File | Change |
|------|--------|
| `PostTypeAndTagsPill.tsx` | Replace `UIPostType` with `DatabasePostType`, change `'story'` check to `'experience'` |
| `PostTypeAndTagsModal.tsx` | Replace `UIPostType` with `DatabasePostType`, change toggle default to `'experience'` |
| `CreatePost.tsx` | Remove `VALID_UI_POST_TYPES`, remove `UIPostType` import, change type to `DatabasePostType`, remove journal/watching whitelist |

---

## Step 7: Update `SmartComposerButton.tsx`

- Remove Journal and Currently Watching/Using menu items from popover
- Remove `'journal'` and `'watching'` from `ContentType`
- Keep Post and Review options

---

## Step 8: Update Feed Display (2 files)

| File | Change |
|------|--------|
| `PostFeedItem.tsx` lines 413,416 | Change fallback `'story'` to `'experience'` |
| `PostContentViewer.tsx` lines 340,343 | Change fallback `'story'` to `'experience'` |

---

## Files Changed (14 total)

1. New DB migration SQL
2. `src/components/feed/utils/postUtils.ts`
3. `src/hooks/feed/types.ts`
4. `src/types/entities.ts`
5. `src/types/structuredFields.ts`
6. `src/components/profile/ProfilePostItem.tsx`
7. `src/components/profile/services/profilePostsService.ts`
8. `src/components/feed/EnhancedCreatePostForm.tsx`
9. `src/pages/CreatePost.tsx`
10. `src/components/feed/SmartComposerButton.tsx`
11. `src/components/feed/composer/PostTypeAndTagsModal.tsx`
12. `src/components/feed/composer/PostTypeAndTagsPill.tsx`
13. `src/components/feed/PostFeedItem.tsx`
14. `src/components/content/PostContentViewer.tsx`

Note: `src/integrations/supabase/types.ts` is auto-generated and will update after migration.

## Out of Scope
- Structured fields per post type (next phase)
- Update-as-thread-continuation (future)
- Review/Recommendation-specific composer UX (future)
