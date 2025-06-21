
/**
 * Unified Profile Service - Centralized profile fetching and transformation
 * This service standardizes how profile data is fetched and transformed across the application
 */

import { supabase } from '@/integrations/supabase/client';
import { BaseUserProfile, SafeUserProfile, transformToSafeProfile } from '@/types/profile';

export interface ProfileFetchResult {
  profiles: Record<string, SafeUserProfile>;
  errors: string[];
}

/**
 * Fetch multiple profiles by user IDs with consistent transformation
 */
export const fetchProfilesBatch = async (userIds: string[]): Promise<ProfileFetchResult> => {
  if (!userIds.length) {
    return { profiles: {}, errors: [] };
  }

  // Remove duplicates
  const uniqueUserIds = [...new Set(userIds)];
  
  try {
    const { data: profilesData, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, first_name, last_name, bio, location')
      .in('id', uniqueUserIds);

    if (error) {
      console.error('Error fetching profiles batch:', error);
      return { 
        profiles: {}, 
        errors: [`Failed to fetch profiles: ${error.message}`] 
      };
    }

    // Transform to safe profiles with fallbacks
    const profileMap: Record<string, SafeUserProfile> = {};
    
    // First, add all fetched profiles
    (profilesData || []).forEach(profile => {
      profileMap[profile.id] = transformToSafeProfile(profile as BaseUserProfile);
    });

    // Then, add fallback profiles for missing user IDs
    uniqueUserIds.forEach(userId => {
      if (!profileMap[userId]) {
        profileMap[userId] = transformToSafeProfile(null);
      }
    });

    return { profiles: profileMap, errors: [] };
  } catch (err) {
    console.error('Exception in fetchProfilesBatch:', err);
    
    // Create fallback profiles for all user IDs
    const fallbackProfiles: Record<string, SafeUserProfile> = {};
    uniqueUserIds.forEach(userId => {
      fallbackProfiles[userId] = transformToSafeProfile(null);
    });
    
    return { 
      profiles: fallbackProfiles, 
      errors: [`Exception fetching profiles: ${err}`] 
    };
  }
};

/**
 * Fetch a single profile by user ID
 */
export const fetchSingleProfile = async (userId: string): Promise<SafeUserProfile> => {
  if (!userId) {
    return transformToSafeProfile(null);
  }

  const result = await fetchProfilesBatch([userId]);
  return result.profiles[userId] || transformToSafeProfile(null);
};

/**
 * Add profile data to entities that have user_id
 */
export const attachProfilesToEntities = async <T extends { user_id: string }>(
  entities: T[]
): Promise<Array<T & { user: SafeUserProfile }>> => {
  if (!entities.length) {
    return [];
  }

  // Extract user IDs
  const userIds = entities.map(entity => entity.user_id);
  
  // Fetch profiles
  const { profiles } = await fetchProfilesBatch(userIds);
  
  // Attach profiles to entities
  return entities.map(entity => ({
    ...entity,
    user: profiles[entity.user_id] || transformToSafeProfile(null)
  }));
};

/**
 * Utility to extract profile data from JOIN results
 */
export const extractProfileFromJoinData = (joinData: any): SafeUserProfile => {
  // Handle different JOIN result structures
  const profileData = joinData?.profiles || joinData?.profile || joinData;
  
  if (!profileData) {
    return transformToSafeProfile(null);
  }

  return transformToSafeProfile(profileData as BaseUserProfile);
};
