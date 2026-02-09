
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
  created_at: string | null;
  username_changed_at: string | null;
  deleted_at: string | null;
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
  created_at?: string;
  username_changed_at: string | null;
  deleted_at: string | null;
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

/**
 * Transform raw profile data to safe profile data with fallbacks
 */
export const transformToSafeProfile = (profile: BaseUserProfile | null): SafeUserProfile => {
  if (!profile) {
    return {
      id: '',
      username: PROFILE_FALLBACKS.username,
      avatar_url: PROFILE_FALLBACKS.avatar_url,
      displayName: PROFILE_FALLBACKS.displayName,
      initials: PROFILE_FALLBACKS.initials,
      fullName: null,
      first_name: null,
      last_name: null,
      bio: null,
      location: null,
      username_changed_at: null,
      deleted_at: null,
    };
  }

  const displayName = 
    (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : '') ||
    profile.first_name || 
    profile.username ||
    PROFILE_FALLBACKS.username;

  const initials = (profile.first_name && profile.last_name)
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.first_name
      ? profile.first_name.substring(0, 2).toUpperCase()
      : profile.username
        ? profile.username.substring(0, 2).toUpperCase()
        : PROFILE_FALLBACKS.initials;

  const fullName = profile.first_name && profile.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : profile.first_name || null;

  return {
    id: profile.id,
    username: profile.username || PROFILE_FALLBACKS.username,
    avatar_url: profile.avatar_url,
    displayName,
    initials,
    fullName,
    first_name: profile.first_name,
    last_name: profile.last_name,
    bio: profile.bio,
    location: profile.location,
    created_at: profile.created_at || undefined,
    username_changed_at: profile.username_changed_at,
    deleted_at: profile.deleted_at,
  };
};
