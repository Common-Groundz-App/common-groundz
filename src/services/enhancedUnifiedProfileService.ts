
/**
 * Enhanced Unified Profile Service - Centralized profile fetching with caching and optimization
 * This service consolidates all profile operations with performance optimizations
 */

import { supabase } from '@/integrations/supabase/client';
import { BaseUserProfile, SafeUserProfile, transformToSafeProfile } from '@/types/profile';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_DEBOUNCE_TIME = 100; // 100ms to batch similar requests

// Cache structure
interface CacheEntry {
  profile: SafeUserProfile;
  timestamp: number;
}

interface BatchRequest {
  userIds: string[];
  resolve: (profiles: Record<string, SafeUserProfile>) => void;
  reject: (error: any) => void;
}

class ProfileCache {
  private cache = new Map<string, CacheEntry>();
  private inFlightRequests = new Map<string, Promise<SafeUserProfile>>();
  private pendingBatches: BatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  // Get profile from cache if still valid
  getFromCache(userId: string): SafeUserProfile | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
    if (isExpired) {
      this.cache.delete(userId);
      return null;
    }

    return entry.profile;
  }

  // Store profile in cache
  setCache(userId: string, profile: SafeUserProfile): void {
    this.cache.set(userId, {
      profile,
      timestamp: Date.now()
    });
  }

  // Get in-flight request promise to prevent duplicates
  getInFlightRequest(userId: string): Promise<SafeUserProfile> | null {
    return this.inFlightRequests.get(userId) || null;
  }

  // Set in-flight request promise
  setInFlightRequest(userId: string, promise: Promise<SafeUserProfile>): void {
    this.inFlightRequests.set(userId, promise);
    
    // Clean up after completion
    promise.finally(() => {
      this.inFlightRequests.delete(userId);
    });
  }

  // Add request to batch queue
  addToBatch(userIds: string[], resolve: (profiles: Record<string, SafeUserProfile>) => void, reject: (error: any) => void): void {
    this.pendingBatches.push({ userIds, resolve, reject });

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Set new timeout to process batch
    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, BATCH_DEBOUNCE_TIME);
  }

  // Process all pending batch requests
  private async processBatch(): Promise<void> {
    if (this.pendingBatches.length === 0) return;

    // Collect all unique user IDs from pending batches
    const allUserIds = new Set<string>();
    this.pendingBatches.forEach(batch => {
      batch.userIds.forEach(id => allUserIds.add(id));
    });

    const uniqueUserIds = Array.from(allUserIds);
    
    try {
      // Fetch all profiles at once
      const profiles = await this.fetchProfilesBatchDirect(uniqueUserIds);
      
      // Resolve all pending requests
      this.pendingBatches.forEach(batch => {
        const requestedProfiles: Record<string, SafeUserProfile> = {};
        batch.userIds.forEach(userId => {
          requestedProfiles[userId] = profiles[userId];
        });
        batch.resolve(requestedProfiles);
      });
    } catch (error) {
      // Reject all pending requests
      this.pendingBatches.forEach(batch => {
        batch.reject(error);
      });
    }

    // Clear processed batches
    this.pendingBatches.length = 0;
    this.batchTimeout = null;
  }

  // Direct database fetch for batch processing
  private async fetchProfilesBatchDirect(userIds: string[]): Promise<Record<string, SafeUserProfile>> {
    if (!userIds.length) return {};

    const uniqueUserIds = [...new Set(userIds)];
    
    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, first_name, last_name, bio, location, created_at, username_changed_at, deleted_at')
        .in('id', uniqueUserIds);

      if (error) {
        console.error('Error fetching profiles batch:', error);
        // Return fallback profiles for all requested IDs
        const fallbackProfiles: Record<string, SafeUserProfile> = {};
        uniqueUserIds.forEach(userId => {
          fallbackProfiles[userId] = transformToSafeProfile(null);
        });
        return fallbackProfiles;
      }

      // Transform to safe profiles with cache updates
      const profileMap: Record<string, SafeUserProfile> = {};
      
      // Add fetched profiles
      (profilesData || []).forEach(profile => {
        const safeProfile = transformToSafeProfile(profile as BaseUserProfile);
        profileMap[profile.id] = safeProfile;
        this.setCache(profile.id, safeProfile);
      });

      // Add fallback profiles for missing user IDs
      uniqueUserIds.forEach(userId => {
        if (!profileMap[userId]) {
          const fallbackProfile = transformToSafeProfile(null);
          profileMap[userId] = fallbackProfile;
          this.setCache(userId, fallbackProfile);
        }
      });

      return profileMap;
    } catch (err) {
      console.error('Exception in fetchProfilesBatchDirect:', err);
      
      // Create fallback profiles for all user IDs
      const fallbackProfiles: Record<string, SafeUserProfile> = {};
      uniqueUserIds.forEach(userId => {
        const fallbackProfile = transformToSafeProfile(null);
        fallbackProfiles[userId] = fallbackProfile;
        this.setCache(userId, fallbackProfile);
      });
      
      return fallbackProfiles;
    }
  }

  // Clear expired entries from cache
  clearExpired(): void {
    const now = Date.now();
    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.cache.delete(userId);
      }
    }
  }

  // Public method to invalidate specific user cache
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }

  // Public method to clear all cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache stats for debugging
  getCacheStats(): { size: number; inFlight: number } {
    return {
      size: this.cache.size,
      inFlight: this.inFlightRequests.size
    };
  }
}

// Global cache instance
const profileCache = new ProfileCache();

// Clean up expired cache entries every 5 minutes
setInterval(() => {
  profileCache.clearExpired();
}, 5 * 60 * 1000);

export interface ProfileFetchResult {
  profiles: Record<string, SafeUserProfile>;
  errors: string[];
}

/**
 * Fetch multiple profiles by user IDs with caching and request deduplication
 */
export const fetchProfilesBatch = async (userIds: string[]): Promise<ProfileFetchResult> => {
  if (!userIds.length) {
    return { profiles: {}, errors: [] };
  }

  const uniqueUserIds = [...new Set(userIds)];
  const profiles: Record<string, SafeUserProfile> = {};
  const uncachedUserIds: string[] = [];

  // Check cache first
  uniqueUserIds.forEach(userId => {
    const cachedProfile = profileCache.getFromCache(userId);
    if (cachedProfile) {
      profiles[userId] = cachedProfile;
    } else {
      uncachedUserIds.push(userId);
    }
  });

  // If all profiles are cached, return immediately
  if (uncachedUserIds.length === 0) {
    return { profiles, errors: [] };
  }

  // Use batch processing for uncached profiles
  try {
    const uncachedProfiles = await new Promise<Record<string, SafeUserProfile>>((resolve, reject) => {
      profileCache.addToBatch(uncachedUserIds, resolve, reject);
    });

    // Merge cached and newly fetched profiles
    Object.assign(profiles, uncachedProfiles);

    return { profiles, errors: [] };
  } catch (err) {
    console.error('Exception in fetchProfilesBatch:', err);
    
    // Create fallback profiles for uncached user IDs
    uncachedUserIds.forEach(userId => {
      profiles[userId] = transformToSafeProfile(null);
    });
    
    return { 
      profiles, 
      errors: [`Exception fetching profiles: ${err}`] 
    };
  }
};

/**
 * Fetch a single profile by user ID with caching and request deduplication
 */
export const fetchSingleProfile = async (userId: string): Promise<SafeUserProfile> => {
  if (!userId) {
    return transformToSafeProfile(null);
  }

  // Check cache first
  const cachedProfile = profileCache.getFromCache(userId);
  if (cachedProfile) {
    return cachedProfile;
  }

  // Check if there's already an in-flight request for this user
  const inFlightRequest = profileCache.getInFlightRequest(userId);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  // Create new request
  const fetchPromise = fetchSingleProfileDirect(userId);
  profileCache.setInFlightRequest(userId, fetchPromise);

  return fetchPromise;
};

/**
 * Direct single profile fetch (used internally)
 */
const fetchSingleProfileDirect = async (userId: string): Promise<SafeUserProfile> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, first_name, last_name, bio, location, created_at, username_changed_at, deleted_at')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching single profile:', error);
      const fallbackProfile = transformToSafeProfile(null);
      profileCache.setCache(userId, fallbackProfile);
      return fallbackProfile;
    }

    const safeProfile = transformToSafeProfile(data as BaseUserProfile);
    profileCache.setCache(userId, safeProfile);
    return safeProfile;
  } catch (error) {
    console.error('Exception in fetchSingleProfileDirect:', error);
    const fallbackProfile = transformToSafeProfile(null);
    profileCache.setCache(userId, fallbackProfile);
    return fallbackProfile;
  }
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
  
  // Fetch profiles using enhanced service
  const { profiles } = await fetchProfilesBatch(userIds);
  
  // Attach profiles to entities
  return entities.map(entity => ({
    ...entity,
    user: profiles[entity.user_id] || transformToSafeProfile(null)
  }));
};

/**
 * Utility to extract profile data from JOIN results (for backward compatibility)
 */
export const extractProfileFromJoinData = (joinData: any): SafeUserProfile => {
  const profileData = joinData?.profiles || joinData?.profile || joinData;
  
  if (!profileData) {
    return transformToSafeProfile(null);
  }

  return transformToSafeProfile(profileData as BaseUserProfile);
};

/**
 * Invalidate cache for a specific user (useful for profile updates)
 */
export const invalidateProfileCache = (userId: string): void => {
  profileCache.invalidateCache(userId);
};

/**
 * Get cache statistics for debugging
 */
export const getProfileCacheStats = () => {
  return profileCache.getCacheStats();
};

/**
 * Clear all cached profiles (use with caution)
 */
export const clearAllProfileCache = (): void => {
  profileCache.clearCache();
};

/**
 * Network recommendation context methods
 */

/**
 * Check if user has sufficient network for entity recommendations
 * Requires at least 3 follows AND at least 2 relevant recommendations from network
 */
export const hasStrongNetwork = async (
  userId: string,
  entityId: string
): Promise<boolean> => {
  try {
    // Check follow count
    const { data: followData, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (followError || !followData || followData.length < 3) {
      return false;
    }

    // Check if network has relevant recommendations
    const followingIds = followData.map(f => f.following_id);
    
    const { data: recData, error: recError } = await supabase
      .from('recommendations')
      .select('id')
      .in('user_id', followingIds)
      .gte('rating', 4) // Only high-quality recommendations
      .neq('entity_id', entityId) // Different from current entity
      .limit(2);

    if (recError || !recData || recData.length < 2) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking network strength:', error);
    return false;
  }
};

/**
 * Get user's following IDs for network recommendations
 */
export const getUserFollowingIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) {
      console.error('Error fetching following IDs:', error);
      return [];
    }

    return data?.map(f => f.following_id) || [];
  } catch (error) {
    console.error('Exception in getUserFollowingIds:', error);
    return [];
  }
};

/**
 * Detect mutual connections between users
 */
export const getMutualConnections = async (
  userId: string,
  targetUserIds: string[]
): Promise<Record<string, boolean>> => {
  if (!targetUserIds.length) return {};

  try {
    // Get user's following list
    const userFollowing = await getUserFollowingIds(userId);
    if (userFollowing.length === 0) {
      return targetUserIds.reduce((acc, id) => ({ ...acc, [id]: false }), {});
    }

    // Check which target users also follow the same people (mutual connections)
    const { data, error } = await supabase
      .from('follows')
      .select('follower_id, following_id')
      .in('follower_id', targetUserIds)
      .in('following_id', userFollowing);

    if (error) {
      console.error('Error checking mutual connections:', error);
      return targetUserIds.reduce((acc, id) => ({ ...acc, [id]: false }), {});
    }

    // Build mutual connection map
    const mutualMap: Record<string, boolean> = {};
    targetUserIds.forEach(id => {
      mutualMap[id] = false;
    });

    data?.forEach(follow => {
      mutualMap[follow.follower_id] = true;
    });

    return mutualMap;
  } catch (error) {
    console.error('Exception in getMutualConnections:', error);
    return targetUserIds.reduce((acc, id) => ({ ...acc, [id]: false }), {});
  }
};

/**
 * Create unified recommendation data format for both network and fallback
 */
export interface UnifiedRecommendationData {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  averageRating: number;
  recommendedBy: string[];
  isNetworkRecommendation: boolean;
  displayReason: string;
  userProfiles?: SafeUserProfile[];
}

/**
 * Transform network recommendation to unified format
 */
export const transformNetworkToUnified = (
  networkRec: any,
  userProfiles: SafeUserProfile[]
): UnifiedRecommendationData => {
  return {
    id: networkRec.entity_id,
    name: networkRec.entity_name,
    type: networkRec.entity_type,
    image_url: networkRec.entity_image_url,
    averageRating: networkRec.avg_rating,
    recommendedBy: networkRec.displayUsernames || [],
    isNetworkRecommendation: true,
    displayReason: `Recommended by ${networkRec.displayUsernames?.slice(0, 2).join(', ') || 'your network'}`,
    userProfiles
  };
};

/**
 * Transform fallback recommendation to unified format
 */
export const transformFallbackToUnified = (
  fallbackRec: any
): UnifiedRecommendationData => {
  return {
    id: fallbackRec.entity_id,
    name: fallbackRec.entity_name,
    type: fallbackRec.entity_type,
    image_url: fallbackRec.entity_image_url,
    averageRating: fallbackRec.avg_rating,
    recommendedBy: [],
    isNetworkRecommendation: false,
    displayReason: fallbackRec.displayReason || 'Popular choice',
    userProfiles: []
  };
};
