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
 * DEFERRED: Unverified user restrictions
 * Uncomment and enforce when real users onboard
 * 
 * TODO: Add useEmailVerification hook when ready to enforce
 * TODO: Add EmailVerificationBanner component when ready
 */
// export const UNVERIFIED_USER_RESTRICTIONS = {
//   canBrowse: true,
//   canViewProfiles: true,
//   canEditOwnProfile: true,
//   canChangeUsername: false,
//   canCreatePosts: false,
//   canCreateRecommendations: false,
//   canComment: false,
//   canFollowUsers: false,
//   canLikeContent: false,
//   canSaveContent: true,
// } as const;
