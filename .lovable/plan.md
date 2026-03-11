

# Final Plan: Auth Prompt Modal System

All feedback is valid. Here's the final plan with all improvements incorporated.

## What's New vs Last Version

| Addition | Source | Status |
|---|---|---|
| `requireAuth()` helper | ChatGPT | Adopted — cleaner than repeating `if (!user) { showAuthPrompt(); return }` everywhere |
| Mandatory `surface` param | ChatGPT | Adopted |
| Mobile width constraint `max-w-md w-[90vw]` | ChatGPT | Adopted |
| Fix label: "9 files" not "8 files" | Codex | Adopted |

No other changes needed. The plan is solid — time to build.

## Files to Create (4)

### 1. `src/utils/authUrlBuilder.ts`
Builds `/auth?tab=signup&returnTo=...` using existing encoding convention.

### 2. `src/contexts/AuthPromptContext.tsx`
Provider + hook. Renders single `AuthPromptModal` instance. Exposes `showAuthPrompt()` and `requireAuth()`. Spam-safe (no-op if already open).

```ts
// requireAuth helper — returns true if authenticated, false if not (opens modal)
requireAuth({ action: 'follow', entityName: 'Pizza Place', surface: 'entity_header' })
```

### 3. `src/components/auth/AuthPromptModal.tsx`
Radix AlertDialog. Mobile-safe with `max-w-md w-[90vw]`. Contains:
- Dynamic title: "Sign up to follow **Pizza Place**"
- Contextual description
- `GoogleSignInButton` (existing component)
- "Continue with Email" link → `/auth?tab=signup&returnTo=...`
- "Already have an account? Log in" link
- "Not now" dismiss
- Analytics on every interaction with mandatory `surface`

### 4. `src/hooks/useAuthPrompt.ts`
Thin re-export of context hook.

## Files to Modify

### `src/App.tsx`
Wrap with `AuthPromptProvider` inside `Router`, outside `Routes`.

### Phase 1 Migration (9 files)
Replace `if (!user) { toast({...}); return; }` with `if (!requireAuth({...})) return;`

1. `src/components/entity/EntityFollowButton.tsx` — follow
2. `src/hooks/use-entity-save.ts` — save
3. `src/hooks/use-optimistic-interactions.ts` — like/save
4. `src/hooks/recommendations/use-recommendation-actions.ts` — like recommendation
5. `src/pages/EntityDetail.tsx` — recommend/review
6. `src/pages/EntityDetailV2.tsx` — recommend/review
7. `src/components/entity-v4/EntityV4.tsx` — review/timeline
8. `src/components/entity-v4/EntitySuggestionButton.tsx` — suggest edit
9. `src/components/entity-v4/ClaimBusinessButton.tsx` — claim business

Each is a simple swap — existing `trackGuestEvent` calls stay, `requireAuth` handles the modal + analytics.

