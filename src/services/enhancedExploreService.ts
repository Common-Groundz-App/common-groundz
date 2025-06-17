
import { supabase } from '@/integrations/supabase/client';

export interface PersonalizedEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  image_url?: string;
  venue?: string;
  metadata?: any;
  personalization_score?: number;
  trending_score?: number;
  is_hidden_gem?: boolean;
  reason?: string;
}

export interface UserInteractionData {
  entityType: string;
  category: string;
  interactionScore: number;
}

// Enhanced service for personalized entity recommendations
export class EnhancedExploreService {
  
  // Track user interactions silently
  async trackUserInteraction(
    userId: string,
    entityId: string,
    entityType: string,
    category: string,
    interactionType: 'view' | 'like' | 'save' | 'click' = 'view'
  ) {
    try {
      // Track in entity_views
      await supabase.from('entity_views').insert({
        entity_id: entityId,
        user_id: userId,
        interaction_type: interactionType,
        metadata: { source: 'explore_page' }
      });

      // Update user interests
      const interactionScore = this.getInteractionScore(interactionType);
      await this.updateUserInterests(userId, entityType, category, interactionScore);
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  private getInteractionScore(interactionType: string): number {
    const scores = {
      'view': 1,
      'click': 2,
      'like': 3,
      'save': 5
    };
    return scores[interactionType as keyof typeof scores] || 1;
  }

  private async updateUserInterests(
    userId: string,
    entityType: string,
    category: string,
    scoreIncrement: number
  ) {
    try {
      // Use upsert to update or create user interest
      await supabase.from('user_interests').upsert({
        user_id: userId,
        entity_type: entityType,
        category: category,
        interest_score: scoreIncrement,
        interaction_count: 1,
        last_interaction: new Date().toISOString()
      }, {
        onConflict: 'user_id,entity_type,category',
        // On conflict, we'll handle the increment in a separate update
      });

      // If record exists, increment the scores
      const { data: existing } = await supabase
        .from('user_interests')
        .select('*')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('category', category)
        .single();

      if (existing) {
        await supabase
          .from('user_interests')
          .update({
            interest_score: existing.interest_score + scoreIncrement,
            interaction_count: existing.interaction_count + 1,
            last_interaction: new Date().toISOString()
          })
          .eq('id', existing.id);
      }
    } catch (error) {
      console.error('Error updating user interests:', error);
    }
  }

  // Get personalized featured entities
  async getPersonalizedFeaturedEntities(userId?: string, limit: number = 3): Promise<PersonalizedEntity[]> {
    try {
      if (!userId) {
        // Fallback to popular entities for non-authenticated users
        return this.getPopularEntities(limit);
      }

      // Get user interests
      const { data: interests } = await supabase
        .from('user_interests')
        .select('*')
        .eq('user_id', userId)
        .order('interest_score', { ascending: false })
        .limit(5);

      if (!interests || interests.length === 0) {
        return this.getPopularEntities(limit);
      }

      // Get entities based on user interests with trending boost
      const entityTypes = interests.map(i => i.entity_type);
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .in('type', entityTypes)
        .eq('is_deleted', false)
        .order('trending_score', { ascending: false })
        .limit(limit * 2);

      if (!entities) return [];

      // Score entities based on user interests and trending
      const scoredEntities = entities.map(entity => {
        const userInterest = interests.find(i => i.entity_type === entity.type);
        const interestScore = userInterest?.interest_score || 0;
        const trendingScore = entity.trending_score || 0;
        
        return {
          ...entity,
          personalization_score: (interestScore * 0.7) + (trendingScore * 0.3),
          reason: userInterest ? 'Based on your interests' : 'Trending now'
        };
      });

      return scoredEntities
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting personalized entities:', error);
      return this.getPopularEntities(limit);
    }
  }

  // Get trending entities for category
  async getTrendingEntitiesByCategory(category?: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      let query = supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false);

      if (category && this.isValidEntityType(category)) {
        query = query.eq('type', category);
      }

      const { data: entities } = await query
        .order('trending_score', { ascending: false })
        .limit(limit);

      if (!entities) return [];

      return entities.map(entity => ({
        ...entity,
        reason: 'Trending this week'
      }));
    } catch (error) {
      console.error('Error getting trending entities:', error);
      return [];
    }
  }

  // Get hidden gems (high rating, low views)
  async getHiddenGems(category?: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      let query = supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(rating)
        `)
        .eq('is_deleted', false)
        .lt('recent_views_24h', 50); // Low views

      if (category && this.isValidEntityType(category)) {
        query = query.eq('type', category);
      }

      const { data: entities } = await query.limit(limit * 2);

      if (!entities) return [];

      // Filter entities with good ratings but low visibility
      const hiddenGems = entities
        .filter(entity => {
          const avgRating = entity.recommendations?.length > 0 
            ? entity.recommendations.reduce((sum: number, rec: any) => sum + rec.rating, 0) / entity.recommendations.length
            : 0;
          return avgRating >= 4.0;
        })
        .slice(0, limit);

      return hiddenGems.map(entity => ({
        ...entity,
        is_hidden_gem: true,
        reason: 'Hidden gem - highly rated'
      }));
    } catch (error) {
      console.error('Error getting hidden gems:', error);
      return [];
    }
  }

  // Get curated collections
  async getCuratedCollections(category?: string): Promise<{ [key: string]: PersonalizedEntity[] }> {
    try {
      const { data: collections } = await supabase
        .from('entity_collections')
        .select(`
          *,
          collection_entities(
            entities(*)
          )
        `)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (!collections) return {};

      const result: { [key: string]: PersonalizedEntity[] } = {};

      collections.forEach(collection => {
        const entities = collection.collection_entities
          ?.map((ce: any) => ce.entities)
          .filter(Boolean) || [];
        
        if (entities.length > 0) {
          result[collection.name] = entities.map((entity: any) => ({
            ...entity,
            reason: `From ${collection.name} collection`
          }));
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting curated collections:', error);
      return {};
    }
  }

  private async getPopularEntities(limit: number): Promise<PersonalizedEntity[]> {
    try {
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .order('popularity_score', { ascending: false })
        .limit(limit);

      return entities?.map(entity => ({
        ...entity,
        reason: 'Popular choice'
      })) || [];
    } catch (error) {
      console.error('Error getting popular entities:', error);
      return [];
    }
  }

  private isValidEntityType(category: string): boolean {
    const validTypes = ['book', 'movie', 'place', 'product', 'food'];
    return validTypes.includes(category);
  }
}

export const enhancedExploreService = new EnhancedExploreService();
