/**
 * Authentication Policy Configuration
 * 
 * Centralizing these values makes policy changes easy
 * and prevents magic numbers throughout the codebase.
 */

export const AUTH_CONFIG = {
  /** Minimum password strength score (0-4) required for signup/reset */
  MIN_PASSWORD_SCORE: 3,
  
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
 * PHASE 4 (COMPLETE): Rate Limiting + CAPTCHA
 *   - auth-gateway edge function handles rate limiting for all auth actions
 *   - Cloudflare Turnstile CAPTCHA required for signup
 *   - Rate limit data stored in auth_rate_limits table
 *   - Rate limits:
 *     - Login: 5 attempts/minute, 5 min block
 *     - Signup: 3 attempts/5 min, 15 min block
 *     - Password Reset: 3 attempts/5 min, 10 min block
 *     - Resend Verification: 2 attempts/minute, 5 min block
 * 
 * All layers work together:
 *   - UI provides helpful feedback before action
 *   - RLS enforces at database level (cannot bypass)
 *   - Rate limiting prevents brute force attacks
 *   - CAPTCHA blocks automated signup bots
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
 * Account Recovery Policy for Soft-Deleted Accounts
 * 
 * PHASE 5: Minimal soft delete with 30-day recovery window
 *   - Users can request deletion via Settings > Account > Delete Account
 *   - deleted_at timestamp is set on profiles table
 *   - Recovery is manual via support contact
 *   - After 30 days, data may be permanently deleted (future implementation)
 */
export const ACCOUNT_RECOVERY_POLICY = {
  /** Number of days data is retained before potential hard delete */
  windowDays: 30,
  /** How users can request recovery */
  method: 'Contact support',
  /** Support contact email */
  supportEmail: 'support@commongroundz.com',
  /** User-facing description */
  description: 'Accounts can be restored within 30 days of deletion by contacting support.',
} as const;

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
