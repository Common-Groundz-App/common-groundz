
import { supabase } from '@/integrations/supabase/client';

export interface StandardProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio?: string | null;
  location?: string | null;
  created_at?: string;
  first_name?: string | null;
  last_name?: string | null;
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
export const transformProfile = (profile: StandardProfile): ProfileWithFallbacks => {
  // Generate display name with fallbacks - prioritize first_name + last_name
  let displayName = '';
  
  // First try to construct from first_name and last_name from profiles table
  if (profile.first_name || profile.last_name) {
    displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  }
  
  // If no name from profiles, fall back to username
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
 * Fetch a single profile by user ID
 */
export const fetchSingleProfile = async (userId: string): Promise<ProfileWithFallbacks | null> => {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, location, created_at, first_name, last_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return transformProfile(data);
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
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, location, created_at, first_name, last_name')
      .in('id', userIds);

    if (error) {
      console.error('Error fetching profiles:', error);
      return {};
    }

    const profileMap: Record<string, ProfileWithFallbacks> = {};
    
    // Transform each profile
    profiles?.forEach(profile => {
      profileMap[profile.id] = transformProfile(profile);
    });

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
