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
 * Get network recommendations with caching and quality filtering
 */
export const getNetworkEntityRecommendationsWithCache = async (
  userId: string,
  entityId: string,
  limit: number = 6
): Promise<ProcessedNetworkRecommendation[]> => {
  try {
    // Check cache first
    const cached = getCachedNetworkRecommendations(userId, entityId);
    if (cached) {
      return applyQualityFiltering(cached).slice(0, limit);
    }

    // Fetch fresh data
    const recommendations = await getNetworkEntityRecommendations(userId, entityId, limit * 2); // Fetch more to account for filtering
    
    // Apply quality filtering and recency weighting
    const qualityFiltered = applyQualityFiltering(recommendations);
    const recentWeighted = applyRecencyWeighting(qualityFiltered);
    
    // Cache the results
    cacheNetworkRecommendations(userId, entityId, recentWeighted);
    
    return recentWeighted.slice(0, limit);
  } catch (error) {
    console.error('Error in getNetworkEntityRecommendationsWithCache:', error);
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
    const recDate = new Date(rec.latest_recommendation_date);
    const isRecent = recDate > thirtyDaysAgo;
    
    // Boost score for recent recommendations
    if (isRecent) {
      rec.average_rating = Math.min(rec.average_rating * 1.1, 5); // Cap at 5
    }
    
    return rec;
  }).sort((a, b) => b.average_rating - a.average_rating);
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