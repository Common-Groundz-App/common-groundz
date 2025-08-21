/**
 * Fallback Recommendation Service - Provides trending/popular entities when network recommendations are insufficient
 * Uses the fallback database functions created in Phase 1
 */

import { supabase } from '@/integrations/supabase/client';

export interface FallbackRecommendationData {
  average_rating: number;
  entity_id: string;
  entity_image_url: string;
  entity_name: string;
  entity_slug: string;
  entity_type: string;
  popularity_score: number;
  reason: string;
  recommendation_count: number;
  trending_score: number;
}

export interface ProcessedFallbackRecommendation extends FallbackRecommendationData {
  displayReason: string;
  score: number;
}

/**
 * Get fallback entity recommendations
 */
export const getFallbackEntityRecommendations = async (
  entityId: string,
  entityType?: string,
  limit: number = 6
): Promise<ProcessedFallbackRecommendation[]> => {
  try {
    const { data, error } = await supabase.rpc('get_fallback_entity_recommendations', {
      p_entity_id: entityId,
      p_limit: limit
    });

    if (error) {
      console.error('Error fetching fallback recommendations:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Process recommendations with display context
    const processedRecommendations: ProcessedFallbackRecommendation[] = data.map((rec: FallbackRecommendationData) => {
      const displayReason = rec.reason || 'Popular choice';
      const score = calculateFallbackScore(rec);

      return {
        ...rec,
        displayReason,
        score
      };
    });

    // Sort by calculated score (highest first)
    processedRecommendations.sort((a, b) => b.score - a.score);

    return processedRecommendations;
  } catch (error) {
    console.error('Exception in getFallbackEntityRecommendations:', error);
    return [];
  }
};

/**
 * Get display reason for fallback recommendation (simplified)
 */
const getFallbackDisplayReason = (recommendation: FallbackRecommendationData): string => {
  return recommendation.reason || 'Popular choice';
};

/**
 * Calculate composite score for fallback recommendations
 */
const calculateFallbackScore = (recommendation: FallbackRecommendationData): number => {
  const {
    popularity_score,
    trending_score,
    recommendation_count,
    average_rating
  } = recommendation;

  let score = 0;

  // Base scores (normalized 0-1)
  score += (popularity_score || 0) * 0.3;
  score += (trending_score || 0) * 0.3;
  score += Math.min((recommendation_count || 0) / 50, 1) * 0.2; // Normalize rec count
  score += ((average_rating || 0) / 5) * 0.2; // Normalize rating

  // Bonus multipliers
  if (average_rating >= 4.5) score *= 1.1;
  if (recommendation_count >= 20) score *= 1.1;

  return score;
};

/**
 * Get trending entities for fallback
 */
export const getTrendingEntities = async (
  entityId: string,
  entityType?: string,
  limit: number = 3
): Promise<ProcessedFallbackRecommendation[]> => {
  const fallbackRecs = await getFallbackEntityRecommendations(entityId, entityType, limit * 2);
  
  // Filter for trending entities (high trending score)
  const trendingRecs = fallbackRecs
    .filter(rec => rec.trending_score > 0.5)
    .slice(0, limit);

  return trendingRecs;
};

/**
 * Get category-specific recommendations
 */
export const getCategoryRecommendations = async (
  entityId: string,
  entityType: string,
  limit: number = 3
): Promise<ProcessedFallbackRecommendation[]> => {
  const fallbackRecs = await getFallbackEntityRecommendations(entityId, entityType, limit * 2);
  
  // Filter for same type entities
  const categoryRecs = fallbackRecs
    .filter(rec => rec.entity_type === entityType)
    .slice(0, limit);

  return categoryRecs;
};

/**
 * Get highly rated recommendations
 */
export const getHighlyRatedRecommendations = async (
  entityId: string,
  entityType?: string,
  limit: number = 3
): Promise<ProcessedFallbackRecommendation[]> => {
  const fallbackRecs = await getFallbackEntityRecommendations(entityId, entityType, limit * 2);
  
  // Filter for highly rated (4.5+)
  const highlyRatedRecs = fallbackRecs
    .filter(rec => rec.average_rating >= 4.5)
    .slice(0, limit);

  return highlyRatedRecs;
};

/**
 * Cache configuration for fallback recommendations
 */
const FALLBACK_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (longer than network cache)
const fallbackCache = new Map<string, { data: ProcessedFallbackRecommendation[]; timestamp: number }>();

/**
 * Get cached fallback recommendations with TTL
 */
export const getCachedFallbackRecommendations = (
  entityId: string,
  entityType?: string
): ProcessedFallbackRecommendation[] | null => {
  const cacheKey = `${entityId}:${entityType || 'any'}`;
  const cached = fallbackCache.get(cacheKey);
  
  if (!cached) return null;
  
  const isExpired = Date.now() - cached.timestamp > FALLBACK_CACHE_TTL;
  if (isExpired) {
    fallbackCache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
};

/**
 * Cache fallback recommendations
 */
export const cacheFallbackRecommendations = (
  entityId: string,
  entityType: string | undefined,
  data: ProcessedFallbackRecommendation[]
): void => {
  const cacheKey = `${entityId}:${entityType || 'any'}`;
  fallbackCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Get fallback recommendations with caching
 */
export const getFallbackEntityRecommendationsWithCache = async (
  entityId: string,
  entityType?: string,
  limit: number = 6
): Promise<ProcessedFallbackRecommendation[]> => {
  // Check cache first
  const cached = getCachedFallbackRecommendations(entityId, entityType);
  if (cached) {
    return cached.slice(0, limit);
  }

  // Fetch fresh data
  const recommendations = await getFallbackEntityRecommendations(entityId, entityType, limit);
  
  // Cache the results
  cacheFallbackRecommendations(entityId, entityType, recommendations);
  
  return recommendations;
};

/**
 * Get mixed recommendation strategy (trending + category + highly rated)
 */
export const getMixedFallbackRecommendations = async (
  entityId: string,
  entityType?: string,
  limit: number = 6
): Promise<ProcessedFallbackRecommendation[]> => {
  const [trending, category, highlyRated] = await Promise.all([
    getTrendingEntities(entityId, entityType, 2),
    getCategoryRecommendations(entityId, entityType, 2),
    getHighlyRatedRecommendations(entityId, entityType, 2)
  ]);

  // Combine and deduplicate
  const combined = [...trending, ...category, ...highlyRated];
  const seen = new Set<string>();
  const unique = combined.filter(rec => {
    if (seen.has(rec.entity_id)) return false;
    seen.add(rec.entity_id);
    return true;
  });

  // Sort by score and limit
  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, limit);
};