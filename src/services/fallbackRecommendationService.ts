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
    console.log('🔍 Fetching fallback recommendations for entity:', entityId);
    
    const { data, error } = await supabase.rpc('get_fallback_entity_recommendations', {
      p_entity_id: entityId,
      p_limit: limit
    });

    if (error) {
      console.error('❌ Error fetching fallback recommendations:', error);
      console.error('Error details:', { message: error.message, details: error.details, hint: error.hint });
      return [];
    }

    if (!data || data.length === 0) {
      console.log('📭 No fallback recommendations found');
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
 * Get mixed recommendation strategy with diversity controls (Phase 4.3)
 */
export const getMixedFallbackRecommendations = async (
  entityId: string,
  entityType?: string,
  limit: number = 6
): Promise<ProcessedFallbackRecommendation[]> => {
  try {
    const [trending, category, highlyRated] = await Promise.all([
      getTrendingEntities(entityId, entityType, 3),
      getCategoryRecommendations(entityId, entityType, 3),
      getHighlyRatedRecommendations(entityId, entityType, 3)
    ]);

    // Combine and deduplicate
    const combined = [...trending, ...category, ...highlyRated];
    const seen = new Set<string>();
    const unique = combined.filter(rec => {
      if (seen.has(rec.entity_id)) return false;
      seen.add(rec.entity_id);
      return true;
    });

    // Apply diversity controls and rating balance
    const diversified = applyDiversityControls(unique, limit);
    
    return diversified;
  } catch (error) {
    console.error('Error in getMixedFallbackRecommendations:', error);
    return [];
  }
};

/**
 * Apply diversity controls to prevent category repetition (Phase 4.3)
 */
const applyDiversityControls = (
  recommendations: ProcessedFallbackRecommendation[],
  limit: number
): ProcessedFallbackRecommendation[] => {
  const categoryCount = new Map<string, number>();
  const result: ProcessedFallbackRecommendation[] = [];
  
  // Sort by score first
  const sorted = recommendations.sort((a, b) => b.score - a.score);
  
  for (const rec of sorted) {
    if (result.length >= limit) break;
    
    const currentCount = categoryCount.get(rec.entity_type) || 0;
    
    // Limit: max 2 items per category
    if (currentCount < 2) {
      result.push(rec);
      categoryCount.set(rec.entity_type, currentCount + 1);
    }
  }
  
  // If we don't have enough diverse items, fill with remaining high-scoring ones
  if (result.length < limit) {
    const remaining = sorted.filter(rec => !result.includes(rec));
    result.push(...remaining.slice(0, limit - result.length));
  }
  
  return applyRatingBalance(result);
};

/**
 * Balance high-rated and trending items (Phase 4.3)
 */
const applyRatingBalance = (
  recommendations: ProcessedFallbackRecommendation[]
): ProcessedFallbackRecommendation[] => {
  const highRated = recommendations.filter(rec => rec.average_rating >= 4.5);
  const trending = recommendations.filter(rec => rec.trending_score > 0.6 && rec.average_rating < 4.5);
  const others = recommendations.filter(rec => 
    rec.average_rating < 4.5 && rec.trending_score <= 0.6
  );
  
  // Aim for 60% high-rated, 30% trending, 10% others
  const targetHighRated = Math.ceil(recommendations.length * 0.6);
  const targetTrending = Math.ceil(recommendations.length * 0.3);
  
  const balanced = [
    ...highRated.slice(0, targetHighRated),
    ...trending.slice(0, targetTrending),
    ...others
  ];
  
  return balanced.slice(0, recommendations.length);
};