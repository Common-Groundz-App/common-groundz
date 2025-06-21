
/**
 * Core profile types for consistent user data handling across the application
 */

// Base profile data as stored in the database
export interface BaseUserProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  location: string | null;
}

// Enhanced profile with computed fields for UI consumption
export interface EnhancedUserProfile extends BaseUserProfile {
  displayName: string;
  initials: string;
  fullName: string | null;
}

// Profile data that's always safe for UI rendering (never null/undefined for critical fields)
export interface SafeUserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  displayName: string;
  initials: string;
  fullName: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  location: string | null;
}

// Profile data as it comes from JOIN queries (nested structure)
export interface ProfileJoinResult {
  profiles: BaseUserProfile | null;
}

// Profile data as it comes from separate profile queries
export interface ProfileQueryResult {
  id: string;
  username: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  location: string | null;
}

// Utility type for transforming raw profile data to safe profile data
export type ProfileTransformer = (profile: BaseUserProfile | null) => SafeUserProfile;

// Standard profile fallbacks
export const PROFILE_FALLBACKS = {
  username: 'Anonymous User',
  displayName: 'Anonymous User',
  initials: 'AU',
  avatar_url: null,
} as const;
