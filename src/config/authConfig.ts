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
 * Unverified user restrictions - UI-level enforcement
 * 
 * PHASE 3 TODO: Add RLS enforcement for these actions
 * when preparing for public launch. Create a security 
 * definer function that checks email_confirmed_at and
 * apply to: posts, post_comments, recommendation_comments,
 * post_likes, recommendation_likes, follows, recommendations tables.
 * 
 * Implementation pattern:
 * 1. CREATE FUNCTION is_email_verified(user_id uuid) RETURNS boolean
 *    AS $$ SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = user_id $$
 *    LANGUAGE sql SECURITY DEFINER;
 * 
 * 2. Add RLS policies to tables (INSERT operations):
 *    WITH CHECK (is_email_verified(auth.uid()))
 * 
 * Trigger: Before public launch or when abuse is detected
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
