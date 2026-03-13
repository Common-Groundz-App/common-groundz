

# Complete Guest Auth Prompt Migration — Final Plan

## Problem
Guest users on public pages experience broken interactions: Like/Save buttons do nothing (silent `if (!user) return`), comment input is disabled with no feedback, and some flows still show legacy "Sign in required" toasts.

## Scope: 11 Files

### 1. `src/contexts/AuthPromptContext.tsx`
Add `postId?: string` and `recommendationId?: string` to `AuthPromptConfig`. Pass them to `trackGuestEvent`.

### 2. `src/components/auth/AuthPromptModal.tsx`
- Add 3 ACTION_COPY entries: `save_insight`, `create_post`, `create_entity`
- Include `postId`/`recommendationId` in `analyticsPayload`

### 3–4. `src/components/content/PostContentViewer.tsx` and `RecommendationContentViewer.tsx`
Replace `if (!user || !post) return` / `if (!user || !recommendation) return` in like/save handlers with:
```ts
if (!requireAuth({ action: 'like', surface: 'post_detail', postId: post?.id })) return;
if (!post) return;
```

### 5. `src/components/feed/PostFeedItem.tsx`
Guard `handleLikeClick` and `handleSaveClick` with `requireAuth()`. Leave `handleDeleteConfirm` unchanged (owner-only).

### 6. `src/components/profile/ProfilePostItem.tsx`
Same pattern as PostFeedItem for like/save. Leave delete unchanged.

### 7. `src/components/recommendations/RecommendationCard.tsx`
Guard `handleLike` with `requireAuth()`. Leave `handleDelete` unchanged.

### 8. `src/components/feed/RecommendationFeedItem.tsx`
Add `requireAuth()` as first line of `handleLike` (before email verification check), with `recommendationId`.

### 9. `src/components/comments/CommentDialog.tsx`
- Remove `!user` from textarea and send button `disabled` props
- Add `hasPromptedRef = useRef(false)` (reset on dialog open)
- Add `onFocus` on textarea: if guest and not yet prompted, call `requireAuth()`, blur, set ref true
- Existing `requireAuth` in `handleAddComment` (line 132) serves as send-button safety net

### 10. `src/hooks/use-saved-insights.ts`
Replace "Sign in required" toast with `requireAuth({ action: 'save_insight', surface: 'saved_insights' })`.

### 11. `src/components/mystuff/JourneyRecommendationCard.tsx`
Replace "Sign in required" toast with `requireAuth({ action: 'save_insight', surface: 'journey_card' })`.

## Implementation Rules
1. `requireAuth()` is always the **first line** in every handler — before analytics, optimistic updates, or email verification
2. Null-safety (`if (!post) return`) comes **after** the auth guard
3. Pass `postId`/`recommendationId`/`entityId`/`entityName` where available
4. Existing `isOpen` guard in AuthPromptProvider prevents duplicate modals on rapid clicks
5. `hasPromptedRef` in CommentDialog prevents repeated popups on dismiss + refocus

## Not Changed (intentionally)
- Admin routes (`AdminEntityManagementPanel`, `AdminEntityEdit`)
- Protected routes (`Feed.tsx`, `FeedForYou.tsx`, `CreateEntityDialog`, etc.)
- Owner-only actions (`handleDeleteConfirm` in PostFeedItem/RecommendationCard/ProfilePostItem)
- `handleEditSave`/`handleDeleteConfirm` in CommentDialog (already behind auth)

