
/**
 * Utility functions for profile data transformation and safety
 */

import { BaseUserProfile, EnhancedUserProfile, SafeUserProfile, ProfileJoinResult, PROFILE_FALLBACKS } from '@/types/profile';

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
    };
  }

  const displayName = profile.username || 
    (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : '') ||
    profile.first_name || 
    PROFILE_FALLBACKS.username;

  const initials = profile.username 
    ? profile.username.substring(0, 2).toUpperCase()
    : (profile.first_name && profile.last_name)
      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
      : profile.first_name
        ? profile.first_name.substring(0, 2).toUpperCase()
        : PROFILE_FALLBACKS.initials;

  const fullName = profile.first_name && profile.last_name 
    ? `${profile.first_name} ${profile.last_name}`
    : profile.first_name || null;

  return {
    id: profile.id,
    username: displayName,
    avatar_url: profile.avatar_url,
    displayName,
    initials,
    fullName,
    first_name: profile.first_name,
    last_name: profile.last_name,
    bio: profile.bio,
    location: profile.location,
  };
};

/**
 * Extract profile data from JOIN query result
 */
export const extractProfileFromJoin = (joinResult: ProfileJoinResult): SafeUserProfile => {
  return transformToSafeProfile(joinResult.profiles);
};

/**
 * Transform multiple profiles to safe profiles
 */
export const transformMultipleProfiles = (profiles: (BaseUserProfile | null)[]): SafeUserProfile[] => {
  return profiles.map(transformToSafeProfile);
};

/**
 * Check if profile data is complete
 */
export const isProfileComplete = (profile: BaseUserProfile | null): boolean => {
  return !!(profile?.username || (profile?.first_name && profile?.last_name));
};

/**
 * Get display name with fallback
 */
export const getDisplayName = (profile: BaseUserProfile | null): string => {
  if (!profile) return PROFILE_FALLBACKS.displayName;
  
  return profile.username || 
    (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : '') ||
    profile.first_name || 
    PROFILE_FALLBACKS.displayName;
};

/**
 * Get user initials with fallback
 */
export const getUserInitials = (profile: BaseUserProfile | null): string => {
  if (!profile) return PROFILE_FALLBACKS.initials;
  
  if (profile.username) {
    return profile.username.substring(0, 2).toUpperCase();
  }
  
  if (profile.first_name && profile.last_name) {
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  }
  
  if (profile.first_name) {
    return profile.first_name.substring(0, 2).toUpperCase();
  }
  
  return PROFILE_FALLBACKS.initials;
};
