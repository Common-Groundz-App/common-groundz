
import { supabase } from '@/integrations/supabase/client';
import { PersonalizedEntity } from './enhancedExploreService';

export interface UserSimilarity {
  userId: string;
  similarityScore: number;
  commonEntities: number;
}

export interface EnhancedUserSimilarity {
  user_a_id: string;
  user_b_id: string;
  similarity_type: string;
  overall_score: number;
  lifestyle_score: number;
  category_overlap: number;
  journey_alignment: number;
  stuff_overlap: any; // Json type from Supabase
  routines_similarity: any; // Json type from Supabase
  calculation_metadata?: any; // Json type from Supabase
  last_calculated: string;
}

export interface RecommendationExplanation {
  type: 'collaborative' | 'social' | 'content' | 'temporal' | 'lifestyle';
  text: string;
  confidence: number;
  algorithm: string;
}

export class CollaborativeFilteringService {

  // Find similar users based on rating patterns
  async findSimilarUsers(userId: string, limit: number = 10): Promise<UserSimilarity[]> {
    try {
      // Get entity IDs that the user has rated
      const { data: userEntityIds } = await supabase
        .from('recommendations')
        .select('entity_id')
        .eq('user_id', userId);

      if (!userEntityIds || userEntityIds.length === 0) return [];

      const entityIds = userEntityIds.map(r => r.entity_id);

      // Get users who have rated similar entities
      const { data: candidateUsers } = await supabase
        .from('recommendations')
        .select('user_id')
        .neq('user_id', userId)
        .in('entity_id', entityIds);

      if (!candidateUsers) return [];

      const uniqueUsers = [...new Set(candidateUsers.map(u => u.user_id))];
      const similarities: UserSimilarity[] = [];

      // Calculate similarity for each candidate user
      for (const candidateUserId of uniqueUsers.slice(0, 50)) { // Limit to prevent timeouts
        const { data: similarityResult } = await supabase
          .rpc('calculate_user_similarity', {
            user_a_id: userId,
            user_b_id: candidateUserId
          });

        if (similarityResult && similarityResult > 0.1) { // Minimum similarity threshold
          similarities.push({
            userId: candidateUserId,
            similarityScore: similarityResult,
            commonEntities: 0 // Will be calculated separately if needed
          });
        }
      }

      // Store similarities in cache for future use
      await this.cacheSimilarities(userId, similarities);

      return similarities
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Error finding similar users:', error);
      return [];
    }
  }

  // Get collaborative filtering recommendations
  async getCollaborativeRecommendations(
    userId: string, 
    limit: number = 6
  ): Promise<PersonalizedEntity[]> {
    try {
      // Get similar users
      const similarUsers = await this.findSimilarUsers(userId, 20);
      
      if (similarUsers.length === 0) {
        return [];
      }

      const similarUserIds = similarUsers.map(u => u.userId);

      // Get user's already rated entities to exclude them
      const { data: userRatedEntities } = await supabase
        .from('recommendations')
        .select('entity_id')
        .eq('user_id', userId);

      const userRatedEntityIds = userRatedEntities?.map(r => r.entity_id) || [];

      // Get entities liked by similar users that current user hasn't rated
      const { data: entities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', similarUserIds)
        .gte('recommendations.rating', 4) // Only high-rated recommendations
        .not('id', 'in', `(${userRatedEntityIds.map(id => `'${id}'`).join(',')})`)
        .order('recommendations.rating', { ascending: false })
        .limit(limit * 2);

      if (!entities) return [];

      // Score entities based on similar users' ratings and similarity scores
      const scoredEntities = entities.map(entity => {
        const similarUserRatings = entity.recommendations?.filter(r => 
          similarUserIds.includes(r.user_id)
        ) || [];

        let weightedScore = 0;
        let totalWeight = 0;

        similarUserRatings.forEach(rating => {
          const userSimilarity = similarUsers.find(u => u.userId === rating.user_id);
          if (userSimilarity) {
            const weight = userSimilarity.similarityScore;
            weightedScore += rating.rating * weight;
            totalWeight += weight;
          }
        });

        const averageWeightedRating = totalWeight > 0 ? weightedScore / totalWeight : 0;

        return {
          ...entity,
          personalization_score: averageWeightedRating,
          reason: `Users like you rated this ${averageWeightedRating.toFixed(1)}/5`
        };
      });

      return scoredEntities
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting collaborative recommendations:', error);
      return [];
    }
  }

  // Get item-based collaborative filtering recommendations
  async getItemBasedRecommendations(
    userId: string, 
    limit: number = 6
  ): Promise<PersonalizedEntity[]> {
    try {
      // Get user's highly rated entities
      const { data: userLikedEntities } = await supabase
        .from('recommendations')
        .select('entity_id, rating')
        .eq('user_id', userId)
        .gte('rating', 4)
        .order('rating', { ascending: false })
        .limit(10);

      if (!userLikedEntities || userLikedEntities.length === 0) {
        return [];
      }

      const likedEntityIds = userLikedEntities.map(e => e.entity_id);

      // Get users who liked similar items
      const { data: similarItemUsers } = await supabase
        .from('recommendations')
        .select('user_id')
        .in('entity_id', likedEntityIds)
        .gte('rating', 4);

      if (!similarItemUsers) return [];

      const similarUserIds = [...new Set(similarItemUsers.map(u => u.user_id))];

      // Find entities that users who liked similar items also liked
      const { data: similarEntities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating, entity_id)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', similarUserIds)
        .not('id', 'in', `(${likedEntityIds.map(id => `'${id}'`).join(',')})`) // Exclude already rated entities
        .gte('recommendations.rating', 4)
        .order('recommendations.rating', { ascending: false })
        .limit(limit * 2);

      if (!similarEntities) return [];

      // Score based on frequency and ratings
      const entityScores = new Map<string, { entity: any, score: number, count: number }>();

      similarEntities.forEach(entity => {
        const existing = entityScores.get(entity.id);
        const rating = entity.recommendations?.[0]?.rating || 0;
        
        if (existing) {
          existing.score += rating;
          existing.count += 1;
        } else {
          entityScores.set(entity.id, {
            entity,
            score: rating,
            count: 1
          });
        }
      });

      // Convert to array and calculate final scores
      const scoredEntities = Array.from(entityScores.values())
        .map(({ entity, score, count }) => ({
          ...entity,
          personalization_score: (score / count) * Math.log(count + 1), // Boost popular items
          reason: `${count} similar items suggest this`
        }))
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

      return scoredEntities;

    } catch (error) {
      console.error('Error getting item-based recommendations:', error);
      return [];
    }
  }

  // Cache user similarities for performance
  private async cacheSimilarities(userId: string, similarities: UserSimilarity[]) {
    try {
      const similarityData = similarities.map(sim => ({
        user_a_id: userId,
        user_b_id: sim.userId,
        similarity_score: sim.similarityScore,
        similarity_type: 'collaborative'
      }));

      await supabase
        .from('user_similarities')
        .upsert(similarityData, {
          onConflict: 'user_a_id,user_b_id,similarity_type'
        });
    } catch (error) {
      console.error('Error caching similarities:', error);
    }
  }

  // Get cached similarities if available
  async getCachedSimilarities(userId: string): Promise<UserSimilarity[]> {
    try {
      const { data: similarities } = await supabase
        .from('user_similarities')
        .select('user_b_id, similarity_score')
        .eq('user_a_id', userId)
        .eq('similarity_type', 'collaborative')
        .gte('last_calculated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('similarity_score', { ascending: false });

      return similarities?.map(s => ({
        userId: s.user_b_id,
        similarityScore: s.similarity_score,
        commonEntities: 0
      })) || [];
    } catch (error) {
      console.error('Error getting cached similarities:', error);
      return [];
    }
  }

  // Phase 4: Find similar users using enhanced lifestyle similarity with hybrid fallback
  async findSimilarUsersEnhanced(userId: string, limit: number = 10): Promise<EnhancedUserSimilarity[]> {
    try {
      const recentThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // 6 hours

      // First check for cached lifestyle similarities
      const { data: cached } = await supabase
        .from('user_similarities')
        .select('*')
        .eq('user_a_id', userId)
        .eq('similarity_type', 'lifestyle')
        .gte('last_calculated', recentThreshold)
        .order('overall_score', { ascending: false })
        .limit(limit);

      if (cached && cached.length >= 3) {
        console.log(`[EnhancedSimilarity] Using cached similarities for ${userId}, count: ${cached.length}`);
        return cached as EnhancedUserSimilarity[];
      }

      // Trigger edge function to calculate fresh similarities
      console.log(`[EnhancedSimilarity] Triggering calculation for ${userId}`);
      
      const { data: calcResult, error: calcError } = await supabase.functions.invoke(
        'calculate-lifestyle-similarity',
        {
          body: { userId, limit: limit * 2 }
        }
      );

      if (calcError) {
        console.error('[EnhancedSimilarity] Calculation error:', calcError);
        // Fall back to basic collaborative filtering
        const basicSimilarities = await this.findSimilarUsers(userId, limit);
        return basicSimilarities.map(s => ({
          user_a_id: userId,
          user_b_id: s.userId,
          similarity_type: 'lifestyle',
          overall_score: s.similarityScore,
          lifestyle_score: 0,
          category_overlap: 0,
          journey_alignment: 0,
          stuff_overlap: { score: 0, commonEntities: [], commonCategories: [] },
          routines_similarity: { score: 0, commonCategories: [] },
          calculation_metadata: {
            richness_a: 'SPARSE' as const,
            richness_b: 'SPARSE' as const,
            effective_mode: 'SPARSE' as const,
            weights_used: { rating_patterns: 0.6, category_preferences: 0.4 },
            scores: { rating_patterns: s.similarityScore },
            calculated_at: new Date().toISOString()
          },
          last_calculated: new Date().toISOString()
        }));
      }

      console.log(`[EnhancedSimilarity] Calculation completed:`, calcResult);

      // Return fresh results
      const { data: fresh } = await supabase
        .from('user_similarities')
        .select('*')
        .eq('user_a_id', userId)
        .eq('similarity_type', 'lifestyle')
        .order('overall_score', { ascending: false })
        .limit(limit);

      return (fresh || []) as EnhancedUserSimilarity[];
    } catch (error) {
      console.error('[EnhancedSimilarity] Error:', error);
      return [];
    }
  }

  // Get enhanced recommendations using lifestyle similarity
  async getEnhancedCollaborativeRecommendations(
    userId: string,
    limit: number = 6
  ): Promise<PersonalizedEntity[]> {
    try {
      // Get similar users using enhanced similarity
      const similarUsers = await this.findSimilarUsersEnhanced(userId, 20);
      
      if (similarUsers.length === 0) {
        console.log('[EnhancedCollaborative] No similar users, falling back to basic');
        return this.getCollaborativeRecommendations(userId, limit);
      }

      const similarUserIds = similarUsers.map(u => u.user_b_id);
      const similarityMap = new Map(similarUsers.map(u => [u.user_b_id, u]));

      // Get user's already rated entities to exclude them
      const { data: userRatedEntities } = await supabase
        .from('recommendations')
        .select('entity_id')
        .eq('user_id', userId);

      const userRatedEntityIds = userRatedEntities?.map(r => r.entity_id) || [];

      // Get entities liked by similar users that current user hasn't rated
      const { data: entities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', similarUserIds)
        .gte('recommendations.rating', 4)
        .limit(limit * 3);

      if (!entities) return [];

      // Filter out already rated and score entities
      const scoredEntities = entities
        .filter(e => !userRatedEntityIds.includes(e.id))
        .map(entity => {
          const similarUserRatings = entity.recommendations?.filter((r: any) => 
            similarUserIds.includes(r.user_id)
          ) || [];

          let weightedScore = 0;
          let totalWeight = 0;
          let lifestyleBoost = 0;

          similarUserRatings.forEach((rating: any) => {
            const userSimilarity = similarityMap.get(rating.user_id);
            if (userSimilarity) {
              // Weight by overall score with lifestyle boost
              const weight = userSimilarity.overall_score;
              const lifestyleWeight = userSimilarity.lifestyle_score * 0.2;
              weightedScore += rating.rating * (weight + lifestyleWeight);
              totalWeight += weight + lifestyleWeight;
              lifestyleBoost = Math.max(lifestyleBoost, userSimilarity.lifestyle_score);
            }
          });

          const averageWeightedRating = totalWeight > 0 ? weightedScore / totalWeight : 0;
          const mode = similarUsers[0]?.calculation_metadata?.effective_mode || 'SPARSE';

          return {
            ...entity,
            personalization_score: averageWeightedRating,
            reason: mode === 'RICH' 
              ? `People with similar lifestyle rated this ${averageWeightedRating.toFixed(1)}/5`
              : mode === 'MODERATE'
              ? `Similar users rated this ${averageWeightedRating.toFixed(1)}/5`
              : `Users like you rated this ${averageWeightedRating.toFixed(1)}/5`
          };
        });

      return scoredEntities
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

    } catch (error) {
      console.error('[EnhancedCollaborative] Error:', error);
      return this.getCollaborativeRecommendations(userId, limit);
    }
  }
}

export const collaborativeFilteringService = new CollaborativeFilteringService();
