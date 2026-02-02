/**
 * Authentication Policy Configuration
 * 
 * Centralizing these values makes policy changes easy
 * and prevents magic numbers throughout the codebase.
 */

export const AUTH_CONFIG = {
  /** Minimum password strength score (0-4) required for signup/reset */
  MIN_PASSWORD_SCORE: 2,
  
  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 8,
  
  /** Cooldown between resend verification emails (seconds) */
  VERIFICATION_RESEND_COOLDOWN: 60,
  
  /** Cooldown between password reset requests (seconds) */
  PASSWORD_RESET_COOLDOWN: 60,
} as const;

/**
 * Unverified user restrictions - Email verification enforcement COMPLETE
 * 
 * PHASE 2 (COMPLETE): UI-level enforcement via useEmailVerification hook
 *   - Centralized in useEmailVerification.ts
 *   - All UI gates marked with: // Email verification gate (Phase 2 — UI only)
 * 
 * PHASE 3 (COMPLETE): RLS enforcement via is_email_verified() function
 *   - SECURITY DEFINER function queries auth.users.email_confirmed_at
 *   - Applied to INSERT policies on:
 *     - posts
 *     - post_comments
 *     - recommendation_comments
 *     - post_likes
 *     - recommendation_likes
 *     - follows
 *     - recommendations
 * 
 * Both layers work together:
 *   - UI provides helpful feedback before action
 *   - RLS enforces at database level (cannot bypass)
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
