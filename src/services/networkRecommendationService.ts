/**
 * Network Recommendation Service - Fetches entity recommendations from user's network
 * Uses the network database functions created in Phase 1
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchProfilesBatch } from './enhancedUnifiedProfileService';
import { SafeUserProfile } from '@/types/profile';

export interface NetworkRecommendationData {
  average_rating: number;
  entity_id: string;
  entity_image_url: string;
  entity_name: string;
  entity_slug: string;
  entity_type: string;
  is_mutual_connection: boolean;
  latest_recommendation_date: string;
  recommendation_count: number;
  recommender_avatar_url: string;
  recommender_id: string;
  recommender_username: string;
}

export interface ProcessedNetworkRecommendation extends NetworkRecommendationData {
  userProfiles: SafeUserProfile[];
  displayUsernames: string[];
}

/**
 * Check if user has sufficient network recommendations for an entity
 */
export const hasNetworkRecommendations = async (
  userId: string,
  entityId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('has_network_recommendations', {
      p_current_user_id: userId,
      p_entity_id: entityId
    });

    if (error) {
      console.error('Error checking network recommendations:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Exception in hasNetworkRecommendations:', error);
    return false;
  }
};

/**
 * Get entity recommendations from user's network
 */
export const getNetworkEntityRecommendations = async (
  userId: string,
  entityId: string,
  limit: number = 6
): Promise<ProcessedNetworkRecommendation[]> => {
  try {
    const { data, error } = await supabase.rpc('get_network_entity_recommendations', {
      p_current_user_id: userId,
      p_entity_id: entityId,
      p_limit: limit
    });

    if (error) {
      console.error('Error fetching network recommendations:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by entity to combine multiple recommenders
    const entityMap = new Map<string, ProcessedNetworkRecommendation>();
    
    data.forEach((rec: NetworkRecommendationData) => {
      const entityId = rec.entity_id;
      
      if (!entityMap.has(entityId)) {
        entityMap.set(entityId, {
          ...rec,
          userProfiles: [{ 
            id: rec.recommender_id,
            displayName: rec.recommender_username,
            username: rec.recommender_username,
            avatar_url: rec.recommender_avatar_url,
            initials: rec.recommender_username.slice(0, 2).toUpperCase(),
            fullName: null,
            first_name: null,
            last_name: null,
            bio: null,
            location: null
          }],
          displayUsernames: [rec.recommender_username]
        });
      } else {
        const existing = entityMap.get(entityId)!;
        existing.userProfiles.push({
          id: rec.recommender_id,
          displayName: rec.recommender_username,
          username: rec.recommender_username,
          avatar_url: rec.recommender_avatar_url,
          initials: rec.recommender_username.slice(0, 2).toUpperCase(),
          fullName: null,
          first_name: null,
          last_name: null,
          bio: null,
          location: null
        });
        existing.displayUsernames.push(rec.recommender_username);
        // Use highest rating
        existing.average_rating = Math.max(existing.average_rating, rec.average_rating);
      }
    });

    const processedRecommendations = Array.from(entityMap.values());

    return processedRecommendations;
  } catch (error) {
    console.error('Exception in getNetworkEntityRecommendations:', error);
    return [];
  }
};

/**
 * Get network recommendation context for display
 */
export const getNetworkRecommendationContext = (
  recommendation: ProcessedNetworkRecommendation
): string => {
  const { displayUsernames, is_mutual_connection } = recommendation;
  
  if (displayUsernames.length === 0) {
    return 'Recommended by your network';
  }

  if (displayUsernames.length === 1) {
    return `Recommended by ${displayUsernames[0]}`;
  }

  if (displayUsernames.length === 2) {
    return `Recommended by ${displayUsernames[0]} and ${displayUsernames[1]}`;
  }

  const remainingCount = displayUsernames.length - 2;
  const mutualText = is_mutual_connection ? ' (mutual connection)' : '';
  
  return `Recommended by ${displayUsernames[0]}, ${displayUsernames[1]} and ${remainingCount} others${mutualText}`;
};

/**
 * Cache configuration for network recommendations
 */
const NETWORK_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const networkCache = new Map<string, { data: ProcessedNetworkRecommendation[]; timestamp: number }>();

/**
 * Get cached network recommendations with TTL
 */
export const getCachedNetworkRecommendations = (
  userId: string,
  entityId: string
): ProcessedNetworkRecommendation[] | null => {
  const cacheKey = `${userId}:${entityId}`;
  const cached = networkCache.get(cacheKey);
  
  if (!cached) return null;
  
  const isExpired = Date.now() - cached.timestamp > NETWORK_CACHE_TTL;
  if (isExpired) {
    networkCache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
};

/**
 * Cache network recommendations
 */
export const cacheNetworkRecommendations = (
  userId: string,
  entityId: string,
  data: ProcessedNetworkRecommendation[]
): void => {
  const cacheKey = `${userId}:${entityId}`;
  networkCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Get network recommendations with caching
 */
export const getNetworkEntityRecommendationsWithCache = async (
  userId: string,
  entityId: string,
  limit: number = 6
): Promise<ProcessedNetworkRecommendation[]> => {
  // Check cache first
  const cached = getCachedNetworkRecommendations(userId, entityId);
  if (cached) {
    return cached.slice(0, limit);
  }

  // Fetch fresh data
  const recommendations = await getNetworkEntityRecommendations(userId, entityId, limit);
  
  // Cache the results
  cacheNetworkRecommendations(userId, entityId, recommendations);
  
  return recommendations;
};