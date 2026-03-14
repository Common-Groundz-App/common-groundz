
# Auth Prompt Modal System — FULLY IMPLEMENTED

## Status: ✅ Phase 1 + Phase 2 Complete

Replaced all guest auth toasts with a professional, Glassdoor-style modal across all public interaction points.

## Architecture

- `AuthPromptProvider` wraps app inside `Router` (single modal instance)
- `requireAuth({ action, entityName?, entityId?, surface })` — returns `true` if authenticated, opens modal + returns `false` if not
- `AuthPromptModal` — Radix AlertDialog with Google OAuth, email signup, login link, "Not now" dismiss
- `trackGuestEvent` analytics on every interaction (shown, google_clicked, email_clicked, login_clicked, dismissed)

## Files Created (4)

1. `src/utils/authUrlBuilder.ts` — Centralized `/auth?tab=...&returnTo=...` builder
2. `src/contexts/AuthPromptContext.tsx` — Provider, state, `showAuthPrompt()`, `requireAuth()`
3. `src/components/auth/AuthPromptModal.tsx` — Modal UI with action-to-copy mapping
4. `src/hooks/useAuthPrompt.ts` — Thin re-export

## Phase 1 — Files Modified (10)

1. `src/App.tsx` — Wrapped with `AuthPromptProvider`
2. `src/components/entity/EntityFollowButton.tsx` — follow
3. `src/hooks/use-entity-save.ts` — save
4. `src/hooks/use-optimistic-interactions.ts` — like/save
5. `src/hooks/recommendations/use-recommendation-actions.ts` — like/recommend
6. `src/pages/EntityDetail.tsx` — recommend/review/timeline
7. `src/pages/EntityDetailV2.tsx` — recommend/review/timeline
8. `src/components/entity-v4/EntityV4.tsx` — review/timeline
9. `src/components/entity-v4/EntitySuggestionButton.tsx` — suggest edit
10. `src/components/entity-v4/ClaimBusinessButton.tsx` — claim business

## Phase 2 — Files Modified (5)

| File | Action | Surface |
|---|---|---|
| `src/components/profile/reviews/ReviewForm.tsx` | `review` | `review_form` |
| `src/hooks/feed/use-infinite-feed.ts` | `like` / `save` | `feed_like` / `feed_save` |
| `src/hooks/feed/use-feed.ts` | `like` / `save` | `feed_like` / `feed_save` |
| `src/components/feed/EnhancedCreatePostForm.tsx` | `create_post` | `create_post_form` |
| `src/hooks/recommendations/use-entity-operations.ts` | `create_entity` | `entity_creation` |

## Verification

Searched `"Authentication required"` across `src/` — remaining hits are only:
- Admin pages (AdminEntityManagementPanel, AdminEntityEdit, CreateEntityDialog)
- Protected route placeholders (Feed, FeedForYou, FeedFollowing, etc.)
- Edge function auth errors (use-entity-refresh)

No public interaction toasts remain. Migration complete.
