
import { supabase } from '@/integrations/supabase/client';
import { PersonalizedEntity } from './enhancedExploreService';

export interface UserSimilarity {
  userId: string;
  similarityScore: number;
  commonEntities: number;
}

export interface RecommendationExplanation {
  type: 'collaborative' | 'social' | 'content' | 'temporal';
  text: string;
  confidence: number;
  algorithm: string;
}

export class CollaborativeFilteringService {

  // Find similar users based on rating patterns
  async findSimilarUsers(userId: string, limit: number = 10): Promise<UserSimilarity[]> {
    try {
      // Get users who have rated similar entities
      const { data: candidateUsers } = await supabase
        .from('recommendations')
        .select('user_id')
        .neq('user_id', userId)
        .in('entity_id', 
          supabase
            .from('recommendations')
            .select('entity_id')
            .eq('user_id', userId)
        );

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
        .not('id', 'in', 
          supabase
            .from('recommendations')
            .select('entity_id')
            .eq('user_id', userId)
        )
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

      // Find entities that users who liked similar items also liked
      const { data: similarEntities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating, entity_id)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id',
          supabase
            .from('recommendations')
            .select('user_id')
            .in('entity_id', likedEntityIds)
            .gte('rating', 4)
        )
        .not('id', 'in', likedEntityIds) // Exclude already rated entities
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
}

export const collaborativeFilteringService = new CollaborativeFilteringService();
