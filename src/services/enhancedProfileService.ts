
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
 * Enhanced initials generation with better fallback logic
 */
const generateInitials = (profile: StandardProfile): string => {
  console.log('🎯 [ProfileService] Generating initials for profile:', {
    id: profile.id,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name
  });

  // First try: Use first_name and last_name if available
  if (profile.first_name || profile.last_name) {
    const firstInitial = profile.first_name?.charAt(0).toUpperCase() || '';
    const lastInitial = profile.last_name?.charAt(0).toUpperCase() || '';
    const initials = (firstInitial + lastInitial).padEnd(1, firstInitial || lastInitial);
    console.log('✅ [ProfileService] Using name initials:', initials);
    return initials;
  }

  // Second try: Use username
  if (profile.username) {
    // Handle email-like usernames (extract part before @)
    const cleanUsername = profile.username.includes('@') 
      ? profile.username.split('@')[0] 
      : profile.username;
    
    // For username with underscores/dots, take first letter of each part
    if (cleanUsername.includes('_') || cleanUsername.includes('.')) {
      const parts = cleanUsername.split(/[_.]/);
      const initials = parts
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
      console.log('✅ [ProfileService] Using username parts initials:', initials);
      return initials || 'U';
    }
    
    // For regular username, take first two characters or duplicate first if single
    const initials = cleanUsername.length >= 2 
      ? cleanUsername.substring(0, 2).toUpperCase()
      : cleanUsername.charAt(0).toUpperCase().repeat(2);
    console.log('✅ [ProfileService] Using username initials:', initials);
    return initials;
  }

  // Last resort: Use 'U' for User
  console.log('⚠️ [ProfileService] Using fallback initials: U');
  return 'U';
};

/**
 * Enhanced display name generation with better fallback logic
 */
const generateDisplayName = (profile: StandardProfile): string => {
  console.log('🎯 [ProfileService] Generating display name for profile:', {
    id: profile.id,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name
  });

  // First try: Use first_name and last_name if available
  if (profile.first_name || profile.last_name) {
    const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    console.log('✅ [ProfileService] Using name display:', displayName);
    return displayName;
  }

  // Second try: Use username
  if (profile.username) {
    // Clean up email-like usernames
    const cleanUsername = profile.username.includes('@') 
      ? profile.username.split('@')[0] 
      : profile.username;
    console.log('✅ [ProfileService] Using username display:', cleanUsername);
    return cleanUsername;
  }

  // Last resort
  console.log('⚠️ [ProfileService] Using fallback display: Anonymous User');
  return 'Anonymous User';
};

/**
 * Transforms a raw profile into a standardized format with enhanced fallbacks
 */
export const transformProfile = (profile: StandardProfile): ProfileWithFallbacks => {
  console.log('🔄 [ProfileService] Transforming profile:', profile.id);
  
  const displayName = generateDisplayName(profile);
  const initials = generateInitials(profile);
  
  const transformed = {
    ...profile,
    username: profile.username || displayName,
    displayName,
    initials
  };
  
  console.log('✅ [ProfileService] Transformed profile:', {
    id: transformed.id,
    displayName: transformed.displayName,
    initials: transformed.initials,
    avatar_url: transformed.avatar_url ? 'present' : 'missing'
  });
  
  return transformed;
};

/**
 * Fetch a single profile by user ID with enhanced logging
 */
export const fetchSingleProfile = async (userId: string): Promise<ProfileWithFallbacks | null> => {
  if (!userId) {
    console.log('❌ [ProfileService] No userId provided to fetchSingleProfile');
    return null;
  }

  console.log('🔍 [ProfileService] Fetching single profile for:', userId);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, location, created_at, first_name, last_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ [ProfileService] Error fetching profile:', error);
      return null;
    }

    if (!data) {
      console.log('⚠️ [ProfileService] No profile data found for:', userId);
      return null;
    }

    console.log('📊 [ProfileService] Raw profile data:', {
      id: data.id,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      avatar_url: data.avatar_url ? 'present' : 'missing'
    });

    return transformProfile(data);
  } catch (error) {
    console.error('❌ [ProfileService] Exception in fetchSingleProfile:', error);
    return null;
  }
};

/**
 * Fetch multiple profiles by user IDs in a single query with enhanced logging
 */
export const fetchMultipleProfiles = async (userIds: string[]): Promise<Record<string, ProfileWithFallbacks>> => {
  if (!userIds.length) {
    console.log('⚠️ [ProfileService] No userIds provided to fetchMultipleProfiles');
    return {};
  }

  console.log('🔍 [ProfileService] Fetching multiple profiles for:', userIds.length, 'users');

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, location, created_at, first_name, last_name')
      .in('id', userIds);

    if (error) {
      console.error('❌ [ProfileService] Error fetching profiles:', error);
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
        console.log('⚠️ [ProfileService] Creating fallback profile for missing user:', userId);
        profileMap[userId] = transformProfile({
          id: userId,
          username: null,
          avatar_url: null
        });
      }
    });

    console.log('✅ [ProfileService] Successfully fetched/created profiles for', Object.keys(profileMap).length, 'users');
    return profileMap;
  } catch (error) {
    console.error('❌ [ProfileService] Exception in fetchMultipleProfiles:', error);
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
