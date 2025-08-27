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

export interface ProcessedNetworkRecommendation {
  // Core entity data
  entity_id: string;
  entity_name: string;
  entity_type: string;
  entity_image_url: string;
  entity_slug: string;
  entity_venue?: string;
  average_rating: number;
  
  // Recommender data
  user_id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  
  // Aggregated data
  userProfiles: SafeUserProfile[];
  displayUsernames: string[];
  displayAvatars: string[];
  recommendedByUserId: string[];
  
  // Optional enhanced fields
  recommendation_count?: number;
  circle_rating?: number;
  overall_rating?: number;
  latest_recommendation_date?: string;
  has_timeline_updates?: boolean;
  is_mutual_connection?: boolean;
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
      p_user_id: userId,
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
): Promise<any[]> => {
  try {
    const { data, error } = await supabase.rpc('get_network_entity_recommendations', {
      p_user_id: userId,
      p_entity_id: entityId,
      p_limit: limit
    });

    if (error) {
      console.error('❌ Error fetching network recommendations:', error);
      console.error('Error details:', { message: error.message, details: error.details, hint: error.hint });
      return [];
    }

    if (!data || data.length === 0) {
      console.log('📭 No network recommendations found for userId:', userId);
      return [];
    }

    console.log('✅ Network recommendations raw data:', data);
    return data;
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
 * Get aggregated network entity recommendations for discovery with cache
 */
export const getNetworkEntityRecommendationsWithCache = async (
  userId: string, 
  entityId: string, 
  limit: number = 5
): Promise<ProcessedNetworkRecommendation[]> => {
  const cacheKey = `aggregated_network_recs_${userId}_${entityId}`;
  
  // Check cache first
  const cached = getCachedNetworkRecommendations(userId, entityId);
  if (cached) {
    console.log(`[NetworkRecs] Cache hit for user ${userId}, entity ${entityId}`);
    return cached.slice(0, limit);
  }

  console.log(`[NetworkRecs] Cache miss for user ${userId}, entity ${entityId}`);

  try {
    // Get aggregated data from the new database function
    const { data: rawData, error } = await supabase.rpc('get_aggregated_network_recommendations_discovery', {
      current_user_id: userId,
      entity_id_param: entityId,
      limit_param: limit
    });

    if (error) {
      console.error('[NetworkRecs] Error calling aggregated function:', error);
      return [];
    }
    
    if (!rawData || rawData.length === 0) {
      console.log(`[NetworkRecs] No aggregated network recommendations found for user ${userId}, entity ${entityId}`);
      return [];
    }

    // Process the aggregated data
    const processedData: ProcessedNetworkRecommendation[] = rawData.map(rec => {
      const userProfiles = rec.recommender_user_ids?.map((id: string, index: number) => {
        const username = rec.recommender_usernames?.[index] || 'Unknown User';
        return {
          id,
          username,
          avatar_url: rec.recommender_avatars?.[index] || null,
          displayName: username,
          initials: username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          fullName: null,
          first_name: null,
          last_name: null,
          bio: null,
          location: null
        };
      }) || [];

      return {
        // Core entity data
        entity_id: rec.entity_id,
        entity_name: rec.entity_name,
        entity_type: rec.entity_type,
        entity_image_url: rec.entity_image_url,
        entity_slug: rec.entity_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), // Generate slug from name
        average_rating: rec.average_rating || 0,
        
        // Primary recommender data (first in list)
        user_id: rec.recommender_user_ids?.[0] || '',
        username: rec.recommender_usernames?.[0] || 'Unknown User',
        avatar_url: rec.recommender_avatars?.[0] || null,
        created_at: new Date().toISOString(), // Use current date as fallback
        
        // Aggregated data
        userProfiles,
        displayUsernames: rec.recommender_usernames || ['Unknown User'],
        displayAvatars: rec.recommender_avatars?.filter(Boolean) || [],
        recommendedByUserId: rec.recommender_user_ids || [],
        
        // Enhanced fields
        recommendation_count: rec.recommendation_count,
        circle_rating: rec.average_rating,
        overall_rating: rec.average_rating,
        latest_recommendation_date: new Date().toISOString(),
        has_timeline_updates: false,
        is_mutual_connection: false // Not applicable for aggregated data
      };
    });

    // Cache the results
    cacheNetworkRecommendations(userId, entityId, processedData);

    console.log(`[NetworkRecs] Processed ${processedData.length} aggregated recommendations for user ${userId}, entity ${entityId}`);
    
    return processedData;
  } catch (error) {
    console.error('[NetworkRecs] Error fetching aggregated network recommendations:', error);
    return [];
  }
};

/**
 * Apply quality filtering to network recommendations (Phase 4.1)
 */
const applyQualityFiltering = (recommendations: ProcessedNetworkRecommendation[]): ProcessedNetworkRecommendation[] => {
  return recommendations.filter(rec => {
    // Quality threshold: minimum 3.5 rating
    if (rec.average_rating < 3.5) return false;
    
    // Must have valid entity data
    if (!rec.entity_name || !rec.entity_id) return false;
    
    return true;
  });
};

/**
 * Apply recency weighting to boost recent recommendations (Phase 4.1)
 */
const applyRecencyWeighting = (recommendations: ProcessedNetworkRecommendation[]): ProcessedNetworkRecommendation[] => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return recommendations.map(rec => {
    const recDate = new Date(rec.latest_recommendation_date || rec.created_at);
    const isRecent = recDate > thirtyDaysAgo;
    
    // Boost score for recent recommendations
    if (isRecent) {
      rec.average_rating = Math.min(rec.average_rating * 1.1, 5); // Cap at 5
    }
    
    return rec;
  }).sort((a, b) => {
    // Sort by recommendation count first, then by rating
    if ((a.recommendation_count || 1) !== (b.recommendation_count || 1)) {
      return (b.recommendation_count || 1) - (a.recommendation_count || 1);
    }
    return b.average_rating - a.average_rating;
  });
};

/**
 * Check if user has sufficient high-quality network recommendations (Phase 4.1)
 */
export const hasQualityNetworkRecommendations = async (
  userId: string,
  entityId: string,
  minCount: number = 2
): Promise<boolean> => {
  try {
    const recommendations = await getNetworkEntityRecommendationsWithCache(userId, entityId, 10);
    const qualityRecs = applyQualityFiltering(recommendations);
    return qualityRecs.length >= minCount;
  } catch (error) {
    console.error('Error checking quality network recommendations:', error);
    return false;
  }
};