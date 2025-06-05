
import { supabase } from '@/integrations/supabase/client';

export interface StandardProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio?: string | null;
  location?: string | null;
  created_at?: string;
}

export interface ProfileWithFallbacks {
  id: string;
  username: string;
  avatar_url: string | null;
  displayName: string;
  initials: string;
  bio?: string | null;
  location?: string | null;
  created_at?: string;
}

/**
 * Transforms a raw profile into a standardized format with fallbacks
 */
export const transformProfile = (profile: StandardProfile, userMetadata?: any): ProfileWithFallbacks => {
  // Generate display name with fallbacks - prioritize first_name + last_name
  let displayName = '';
  
  // First try to construct from first_name and last_name
  if (userMetadata) {
    const firstName = userMetadata.first_name || '';
    const lastName = userMetadata.last_name || '';
    if (firstName || lastName) {
      displayName = `${firstName} ${lastName}`.trim();
    }
  }
  
  // If no name from metadata, fall back to username
  if (!displayName) {
    displayName = profile.username || 'Anonymous User';
  }

  // Generate initials
  const getInitials = (name: string): string => {
    if (!name || name === 'Anonymous User') return 'AU';
    
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return {
    ...profile,
    username: profile.username || displayName,
    displayName,
    initials: getInitials(displayName)
  };
};

/**
 * Fetch user metadata from Supabase auth
 */
const fetchUserMetadata = async (userId: string) => {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error) {
      console.error('Error fetching user metadata:', error);
      return null;
    }
    
    return data.user?.user_metadata || null;
  } catch (error) {
    console.error('Error in fetchUserMetadata:', error);
    return null;
  }
};

/**
 * Fetch a single profile by user ID
 */
export const fetchSingleProfile = async (userId: string): Promise<ProfileWithFallbacks | null> => {
  if (!userId) return null;

  try {
    // Fetch profile data and user metadata in parallel
    const [profileResult, userMetadata] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, location, created_at')
        .eq('id', userId)
        .single(),
      fetchUserMetadata(userId)
    ]);

    if (profileResult.error) {
      console.error('Error fetching profile:', profileResult.error);
      return null;
    }

    return transformProfile(profileResult.data, userMetadata);
  } catch (error) {
    console.error('Error in fetchSingleProfile:', error);
    return null;
  }
};

/**
 * Fetch multiple profiles by user IDs in a single query
 */
export const fetchMultipleProfiles = async (userIds: string[]): Promise<Record<string, ProfileWithFallbacks>> => {
  if (!userIds.length) return {};

  try {
    // Fetch profile data
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, location, created_at')
      .in('id', userIds);

    if (error) {
      console.error('Error fetching profiles:', error);
      return {};
    }

    const profileMap: Record<string, ProfileWithFallbacks> = {};
    
    // For each profile, fetch user metadata and transform
    for (const profile of profiles || []) {
      const userMetadata = await fetchUserMetadata(profile.id);
      profileMap[profile.id] = transformProfile(profile, userMetadata);
    }

    // Add fallback profiles for missing user IDs
    userIds.forEach(userId => {
      if (!profileMap[userId]) {
        profileMap[userId] = transformProfile({
          id: userId,
          username: null,
          avatar_url: null
        });
      }
    });

    return profileMap;
  } catch (error) {
    console.error('Error in fetchMultipleProfiles:', error);
    return {};
  }
};

/**
 * Fetch profiles that are commonly needed together (followers, following, etc.)
 */
export const fetchProfilesForUserList = async (userIds: string[]): Promise<ProfileWithFallbacks[]> => {
  const profileMap = await fetchMultipleProfiles(userIds);
  return userIds.map(id => profileMap[id]).filter(Boolean);
};
