

# Complete Auth Prompt Modal Migration — Phase 1 Closure

## Summary

The auth modal infrastructure works, but migration was incomplete. 13 files still use legacy `toast("Authentication required")`. This plan migrates all **public-facing entity/profile page** actions (11 files). Admin/feed pages stay as-is (correct pattern or Phase 2).

## Files to Migrate (11)

| # | File | Action | Surface |
|---|---|---|---|
| 1 | `src/hooks/use-reviews.ts` (line 32) | like | `review_card` |
| 2 | `src/hooks/use-reviews.ts` (line 85) | convert review | `review_card` |
| 3 | `src/hooks/use-recommendations.ts` (line 58) | like | `recommendation_card` |
| 4 | `src/hooks/recommendations/use-recommendations.ts` (line 61) | like | `recommendation_card` |
| 5 | `src/components/entity-v4/EntitySuggestionModal.tsx` (line 125) | suggest_edit | `entity_suggestion_modal` |
| 6 | `src/components/entity-v4/ClaimBusinessModal.tsx` (line 124) | claim | `claim_business_modal` |
| 7 | `src/components/entity-v4/PhotosSection.tsx` (line 763) | upload | `entity_photos` |
| 8 | `src/components/entity-v4/MediaPreviewSection.tsx` (line 593) | upload | `entity_media` |
| 9 | `src/components/comments/CommentDialog.tsx` (line 130) | comment | `comment_dialog` |
| 10 | `src/hooks/recommendations/use-recommendation-uploads.ts` (line 14) | upload | `recommendation_upload` |
| 11 | `src/hooks/use-follow.ts` (line 39) | follow | `profile_header` |

**Note on `src/hooks/use-recommendations.ts`**: Only used by `ProfileRecommendations.tsx` — it's active code, not dead. Both recommendation hooks need migration.

## NOT migrated (correct)

- Admin pages (`AdminEntityManagementPanel`, `AdminEntityEdit`) — redirect-based auth
- Feed page (`Feed.tsx`, `FeedForYou.tsx`) — login-required pages
- `CreateEntityDialog` — Phase 2
- `EnhancedCreatePostForm` — Phase 2
- `use-feed.ts` — Phase 2
- `use-entity-operations.ts` — Phase 2

## Pattern

Each file: replace `if (!user) { toast({...}); return; }` with:

```ts
const { requireAuth } = useAuthPrompt();

if (!requireAuth({ action: 'like', surface: 'review_card' })) return;
```

Include `entityName`/`entityId` where available in the component scope.

Place `requireAuth()` as the **first check** in each handler, before any state updates or async calls.

Keep submit-level guards in modal components (ClaimBusinessModal, EntitySuggestionModal) as defensive backup — just switch them from toast to `requireAuth()`.

## Post-migration verification

Run a final search for `"Authentication required"` — only admin/feed pages should remain.

