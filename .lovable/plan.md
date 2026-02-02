

# Phase 2: Email Verification Enforcement - Final Plan

## Summary

This plan implements UI-level enforcement for unverified users, including all feedback from external reviewers:
- ✅ Recommendation creation check (explicitly added)
- ✅ Toast system standardization (using `useToast` consistently)
- ✅ Comment pattern for traceability (`// Email verification gate (Phase 2 — UI only)`)
- ✅ Centralized hook and copy for consistent UX
- ✅ Phase 3 RLS documented but deferred

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        AuthContext                               │
│  (already has isEmailVerified from Phase 1)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   useEmailVerification Hook                      │
│  - canPerformAction(action) → boolean                           │
│  - showVerificationRequired(action) → toast                     │
│  - Uses useToast (standardized, not sonner)                     │
│  - Uses centralized copy from authConfig.ts                     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  EmailVerificationBanner │    │   Integration Points     │
│  (global, in Protected   │    │   (18 locations total)   │
│   Route wrapper)         │    │   See full list below    │
└──────────────────────────┘    └──────────────────────────┘
```

---

## Restriction Policy

| Action | Allowed? | Rationale |
|--------|----------|-----------|
| Browse content | Yes | Low risk, encourages verification |
| View profiles | Yes | Low risk |
| Edit own profile (bio, avatar, location) | Yes | Personal, non-identity fields |
| Save content | Yes | Private action, low risk |
| **Change username** | **No** | Identity action, requires trust |
| **Create posts** | **No** | Public content, spam risk |
| **Create recommendations** | **No** | Core trust feature |
| **Comment** | **No** | Public interaction, spam risk |
| **Follow users** | **No** | Social graph, spam risk |
| **Like content** | **No** | Affects rankings, bot risk |

---

## Implementation Steps

### Step 1: Update Auth Configuration

**File: `src/config/authConfig.ts`**

Activate the restrictions object, add centralized copy, and document Phase 3 RLS:

```typescript
export const AUTH_CONFIG = {
  MIN_PASSWORD_SCORE: 2,
  MIN_PASSWORD_LENGTH: 8,
  VERIFICATION_RESEND_COOLDOWN: 60,
  PASSWORD_RESET_COOLDOWN: 60,
} as const;

/**
 * Unverified user restrictions - UI-level enforcement
 * 
 * PHASE 3 TODO: Add RLS enforcement for these actions
 * when preparing for public launch. Create a security 
 * definer function that checks email_confirmed_at and
 * apply to: posts, post_comments, recommendation_comments,
 * post_likes, recommendation_likes, follows, recommendations tables.
 */
export const UNVERIFIED_USER_RESTRICTIONS = {
  canBrowse: true,
  canViewProfiles: true,
  canEditOwnProfile: true,
  canChangeUsername: false,
  canCreatePosts: false,
  canCreateRecommendations: false,
  canComment: false,
  canFollowUsers: false,
  canLikeContent: false,
  canSaveContent: true,
} as const;

export type RestrictionAction = keyof typeof UNVERIFIED_USER_RESTRICTIONS;

/**
 * Centralized verification-related copy for consistent UX
 */
export const VERIFICATION_MESSAGES = {
  bannerTitle: 'Please verify your email',
  bannerDescription: 'Verify your email to unlock all features.',
  toastTitle: 'Email verification required',
  actionDescriptions: {
    canFollowUsers: 'follow users',
    canLikeContent: 'like content',
    canComment: 'comment',
    canCreatePosts: 'create posts',
    canCreateRecommendations: 'create recommendations',
    canChangeUsername: 'change your username',
  },
  resendButton: 'Resend email',
  resendSuccess: 'Verification email sent!',
  resendError: 'Failed to send verification email',
} as const;
```

---

### Step 2: Create useEmailVerification Hook

**New File: `src/hooks/useEmailVerification.ts`**

Centralized hook using `useToast` (standardized, not sonner):

```typescript
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';  // Standardized
import { 
  UNVERIFIED_USER_RESTRICTIONS, 
  VERIFICATION_MESSAGES,
  RestrictionAction 
} from '@/config/authConfig';

export const useEmailVerification = () => {
  const { user, isEmailVerified, resendVerificationEmail } = useAuth();
  const { toast } = useToast();

  const canPerformAction = useCallback((action: RestrictionAction): boolean => {
    if (isEmailVerified) return true;
    return UNVERIFIED_USER_RESTRICTIONS[action];
  }, [isEmailVerified]);

  const showVerificationRequired = useCallback((action?: RestrictionAction) => {
    const actionDescription = action 
      ? VERIFICATION_MESSAGES.actionDescriptions[action as keyof typeof VERIFICATION_MESSAGES.actionDescriptions]
      : undefined;

    toast({
      title: VERIFICATION_MESSAGES.toastTitle,
      description: actionDescription 
        ? `Please verify your email to ${actionDescription}.`
        : 'Please verify your email to perform this action.',
    });
  }, [toast]);

  const handleResendEmail = useCallback(async () => {
    const { error } = await resendVerificationEmail();
    if (error) {
      toast({
        title: 'Error',
        description: VERIFICATION_MESSAGES.resendError,
        variant: 'destructive',
      });
      return false;
    }
    toast({
      title: 'Email sent',
      description: VERIFICATION_MESSAGES.resendSuccess,
    });
    return true;
  }, [resendVerificationEmail, toast]);

  return {
    isVerified: isEmailVerified,
    userEmail: user?.email,
    canPerformAction,
    showVerificationRequired,
    handleResendEmail,
  };
};
```

---

### Step 3: Create EmailVerificationBanner Component

**New File: `src/components/auth/EmailVerificationBanner.tsx`**

Persistent banner with:
- Amber/warning styling matching design system
- User's email address displayed
- "Resend verification email" button with 60s cooldown
- Dismissible (persists to localStorage)
- Only shows for authenticated, unverified users

---

### Step 4: Integrate Banner into ProtectedRoute

**File: `src/components/ProtectedRoute.tsx`**

Add banner inside ChatProvider wrapper:

```typescript
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';

return (
  <ChatProvider>
    <EmailVerificationBanner />
    {children}
  </ChatProvider>
);
```

---

### Step 5-8: Add Restriction to Follow Hooks

All follow-related hooks get the same pattern:

| File | Function |
|------|----------|
| `src/hooks/use-follow.ts` | `handleFollowToggle` |
| `src/hooks/use-entity-follow.ts` | `toggleFollow` |
| `src/components/profile/circles/hooks/useFollowActions.ts` | `handleFollowToggle` |

Pattern:
```typescript
// Email verification gate (Phase 2 — UI only)
if (!canPerformAction('canFollowUsers')) {
  showVerificationRequired('canFollowUsers');
  return;
}
```

---

### Step 9: Add Restriction to Comment Dialog

**File: `src/components/comments/CommentDialog.tsx`**

Add check in `handleAddComment`:

```typescript
// Email verification gate (Phase 2 — UI only)
if (!canPerformAction('canComment')) {
  showVerificationRequired('canComment');
  return;
}
```

---

### Step 10: Add Restriction to Like Handlers

All like handlers get the same pattern:

| File | Function |
|------|----------|
| `src/hooks/use-recommendations.ts` | `handleLike` |
| `src/hooks/use-reviews.ts` | `handleLike` |
| `src/hooks/recommendations/use-recommendation-actions.ts` | `handleLike` |
| `src/hooks/feed/use-infinite-feed.ts` | `handleLike` |
| `src/components/feed/PostFeedItem.tsx` | `handleLikeClick` |
| `src/components/feed/RecommendationFeedItem.tsx` | `handleLike` |
| `src/components/profile/ProfilePostItem.tsx` | `handleLikeClick` |

Pattern:
```typescript
// Email verification gate (Phase 2 — UI only)
if (!canPerformAction('canLikeContent')) {
  showVerificationRequired('canLikeContent');
  return;
}
```

---

### Step 11: Add Restriction to Post Creation

**File: `src/components/feed/CreatePostButton.tsx`**

Add check before opening dialog (both in onClick and event listener):

```typescript
// Email verification gate (Phase 2 — UI only)
if (!canPerformAction('canCreatePosts')) {
  showVerificationRequired('canCreatePosts');
  return;
}
setIsDialogOpen(true);
```

---

### Step 12: Add Restriction to Recommendation Creation ⭐ (Added per Codex feedback)

**Files to update:**

| File | Function |
|------|----------|
| `src/hooks/recommendations/use-recommendation-actions.ts` | `addRecommendation` (line 112) |
| `src/pages/EntityDetailV2.tsx` | `handleAddRecommendation` (line 268) |
| `src/pages/EntityDetail.tsx` | `handleAddRecommendation` |

Pattern:
```typescript
// Email verification gate (Phase 2 — UI only)
if (!canPerformAction('canCreateRecommendations')) {
  showVerificationRequired('canCreateRecommendations');
  return;
}
```

---

### Step 13: Add Restriction to Username Changes

**File: `src/components/profile/ProfileEditForm.tsx`**

Add verification check alongside existing cooldown check:

```typescript
const { canPerformAction, isVerified } = useEmailVerification();

// Combined lock condition
const isUsernameLocked = cooldownState.isLocked || !isVerified;

// Add verification message in UI
{!isVerified && !cooldownState.isLocked && (
  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
    <AlertTriangle className="h-3 w-3" />
    Verify your email to change your username.
  </p>
)}
```

---

## Complete Files Summary

| File | Change Type | Notes |
|------|-------------|-------|
| `src/config/authConfig.ts` | **UPDATE** | Activate restrictions + add copy + Phase 3 TODO |
| `src/hooks/useEmailVerification.ts` | **NEW** | Centralized hook using useToast |
| `src/components/auth/EmailVerificationBanner.tsx` | **NEW** | Persistent banner |
| `src/components/ProtectedRoute.tsx` | **UPDATE** | Add banner |
| `src/hooks/use-follow.ts` | **UPDATE** | Add follow restriction |
| `src/hooks/use-entity-follow.ts` | **UPDATE** | Add entity follow restriction |
| `src/components/profile/circles/hooks/useFollowActions.ts` | **UPDATE** | Add circle follow restriction |
| `src/components/comments/CommentDialog.tsx` | **UPDATE** | Add comment restriction |
| `src/hooks/use-recommendations.ts` | **UPDATE** | Add like restriction |
| `src/hooks/use-reviews.ts` | **UPDATE** | Add like restriction |
| `src/hooks/recommendations/use-recommendation-actions.ts` | **UPDATE** | Add like + create restriction |
| `src/hooks/feed/use-infinite-feed.ts` | **UPDATE** | Add like restriction |
| `src/components/feed/PostFeedItem.tsx` | **UPDATE** | Add like restriction |
| `src/components/feed/RecommendationFeedItem.tsx` | **UPDATE** | Add like restriction |
| `src/components/profile/ProfilePostItem.tsx` | **UPDATE** | Add like restriction |
| `src/components/feed/CreatePostButton.tsx` | **UPDATE** | Add post creation restriction |
| `src/pages/EntityDetailV2.tsx` | **UPDATE** | Add recommendation creation restriction |
| `src/pages/EntityDetail.tsx` | **UPDATE** | Add recommendation creation restriction |
| `src/components/profile/ProfileEditForm.tsx` | **UPDATE** | Add username lock |

**Total: 2 new files, 17 updated files**

---

## Testing Checklist

1. **Banner visibility**: Unverified user sees amber banner on all protected pages
2. **Banner dismiss**: Click X → banner hidden, persists on refresh
3. **Banner resend**: Click "Resend email" → email sent, 60s cooldown starts
4. **Verified user**: No banner shown, all actions work normally
5. **Follow blocked**: Unverified user clicks Follow → toast with verification message
6. **Entity follow blocked**: Same behavior on entity pages
7. **Like blocked**: Unverified user clicks Like → toast with verification message
8. **Comment blocked**: Unverified user submits comment → toast, comment not added
9. **Post creation blocked**: Unverified user clicks Create Post → toast, dialog doesn't open
10. **Recommendation creation blocked**: Unverified user tries to add recommendation → blocked
11. **Username locked**: Unverified user sees verification message on username field
12. **Other profile fields**: Unverified user CAN edit bio, location, display name

---

## Phase 3 TODO (Documented in authConfig.ts)

```typescript
/**
 * PHASE 3 TODO: Add RLS enforcement for email verification
 * 
 * When preparing for public launch, implement server-side enforcement:
 * 
 * 1. Create security definer function:
 *    CREATE FUNCTION is_email_verified(user_id uuid) RETURNS boolean
 *    AS $$ SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = user_id $$
 *    LANGUAGE sql SECURITY DEFINER;
 * 
 * 2. Add RLS policies to these tables (INSERT operations):
 *    - posts
 *    - post_comments
 *    - recommendation_comments
 *    - post_likes
 *    - recommendation_likes
 *    - follows
 *    - recommendations
 * 
 * 3. Pattern: WITH CHECK (is_email_verified(auth.uid()))
 * 
 * Trigger: Before public launch or when abuse is detected
 */
```

---

## What's Explicitly Deferred to Phase 3+

| Feature | Phase |
|---------|-------|
| RLS enforcement for email verification | Phase 3 |
| Rate limiting / CAPTCHA | Phase 3 |
| Magic link / OTP login | Phase 3+ |
| Social logins (Google, GitHub) | Phase 3+ |

