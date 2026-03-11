
# Auth Prompt Modal System — IMPLEMENTED

## Status: ✅ Phase 1 Complete

Replaced all guest auth toasts with a professional, Glassdoor-style modal across 9 high-intent action points.

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

## Files Modified (10)

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

## Phase 2 (Future)

- Feed interactions, comments, photo uploads, profile page CTAs
- Remaining ~19 files with auth toasts
