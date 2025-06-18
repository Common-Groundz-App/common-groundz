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
  view_velocity?: number;
  is_hidden_gem?: boolean;
  reason?: string;
  geographic_boost?: number;
  seasonal_boost?: number;
}

export interface UserInteractionData {
  entityType: string;
  category: string;
  interactionScore: number;
}

export interface ActivityPattern {
  entityType: string;
  category: string;
  timeOfDay: number;
  dayOfWeek: number;
  activityScore: number;
}

// Enhanced service for personalized entity recommendations
export class EnhancedExploreService {
  
  // Track user interactions with enhanced pattern analysis
  async trackUserInteraction(
    userId: string,
    entityId: string,
    entityType: string,
    category: string,
    interactionType: 'view' | 'like' | 'save' | 'click' = 'view'
  ) {
    try {
      const now = new Date();
      const timeOfDay = now.getHours();
      const dayOfWeek = now.getDay();

      // Track in entity_views
      await supabase.from('entity_views').insert({
        entity_id: entityId,
        user_id: userId,
        interaction_type: interactionType,
        metadata: { 
          source: 'explore_page',
          time_of_day: timeOfDay,
          day_of_week: dayOfWeek
        }
      });

      // Update user interests with enhanced scoring
      const interactionScore = this.getEnhancedInteractionScore(interactionType);
      await this.updateUserInterests(userId, entityType, category, interactionScore);
      
      // Update activity patterns for temporal personalization
      await this.updateActivityPatterns(userId, entityType, category, timeOfDay, dayOfWeek, interactionScore);
      
      // Trigger trending score update for this entity (async)
      this.updateEntityTrendingScore(entityId);
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  private getEnhancedInteractionScore(interactionType: string): number {
    const scores = {
      'view': 1,
      'click': 3,
      'like': 5,
      'save': 8
    };
    return scores[interactionType as keyof typeof scores] || 1;
  }

  private async updateActivityPatterns(
    userId: string,
    entityType: string,
    category: string,
    timeOfDay: number,
    dayOfWeek: number,
    scoreIncrement: number
  ) {
    try {
      // Calculate interaction velocity (interactions per hour in recent activity)
      const { data: recentActivity } = await supabase
        .from('entity_views')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('created_at', { ascending: false });

      const interactionVelocity = (recentActivity?.length || 0) / 1; // interactions per hour

      // Upsert activity pattern
      await supabase.from('user_activity_patterns').upsert({
        user_id: userId,
        entity_type: entityType,
        category: category,
        time_of_day: timeOfDay,
        day_of_week: dayOfWeek,
        activity_score: scoreIncrement,
        interaction_velocity: interactionVelocity,
        last_interaction: new Date().toISOString()
      }, {
        onConflict: 'user_id,entity_type,category,time_of_day,day_of_week'
      });

      // Update existing pattern if it exists
      const { data: existing } = await supabase
        .from('user_activity_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('category', category)
        .eq('time_of_day', timeOfDay)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (existing) {
        await supabase
          .from('user_activity_patterns')
          .update({
            activity_score: existing.activity_score + scoreIncrement,
            interaction_velocity: Math.max(existing.interaction_velocity, interactionVelocity),
            last_interaction: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      }
    } catch (error) {
      console.error('Error updating activity patterns:', error);
    }
  }

  // Update entity trending score (background operation)
  private async updateEntityTrendingScore(entityId: string) {
    try {
      // Call the enhanced trending score function
      await supabase.rpc('calculate_enhanced_trending_score', {
        p_entity_id: entityId
      });
    } catch (error) {
      console.error('Error updating entity trending score:', error);
    }
  }

  // Enhanced personalized featured entities with diversity injection
  async getPersonalizedFeaturedEntities(userId?: string, limit: number = 3): Promise<PersonalizedEntity[]> {
    try {
      if (!userId) {
        return this.getPopularEntities(limit);
      }

      // Get user interests with temporal patterns
      const { data: interests } = await supabase
        .from('user_interests')
        .select('*')
        .eq('user_id', userId)
        .order('interest_score', { ascending: false })
        .limit(10);

      // Get user activity patterns for current time context
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();
      
      const { data: patterns } = await supabase
        .from('user_activity_patterns')
        .select('*')
        .eq('user_id', userId)
        .or(`time_of_day.eq.${currentHour},day_of_week.eq.${currentDay}`)
        .order('activity_score', { ascending: false })
        .limit(5);

      if (!interests || interests.length === 0) {
        return this.getPopularEntities(limit);
      }

      // Apply seasonal and geographic boosts
      await this.applySeasonalBoosts();
      
      // Get entities with enhanced scoring
      const validEntityTypes = interests
        .map(i => i.entity_type)
        .filter(type => this.isValidEntityType(type)) as ('book' | 'movie' | 'place' | 'product' | 'food')[];

      if (validEntityTypes.length === 0) {
        return this.getPopularEntities(limit);
      }

      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .in('type', validEntityTypes)
        .eq('is_deleted', false)
        .order('trending_score', { ascending: false })
        .limit(limit * 3); // Get more for diversity filtering

      if (!entities) return [];

      // Enhanced scoring with temporal context and diversity
      const scoredEntities = entities.map(entity => {
        const userInterest = interests.find(i => i.entity_type === entity.type);
        const timePattern = patterns?.find(p => 
          p.entity_type === entity.type && 
          (p.time_of_day === currentHour || p.day_of_week === currentDay)
        );
        
        const interestScore = userInterest?.interest_score || 0;
        const temporalBoost = timePattern?.activity_score || 0;
        const trendingScore = entity.trending_score || 0;
        const velocityBoost = (entity.view_velocity || 0) * 0.1;
        const geographicBoost = entity.geographic_boost || 0;
        const seasonalBoost = entity.seasonal_boost || 0;
        
        const personalizationScore = 
          (interestScore * 0.35) + 
          (trendingScore * 0.25) + 
          (temporalBoost * 0.15) + 
          (velocityBoost * 0.1) + 
          (geographicBoost * 0.08) + 
          (seasonalBoost * 0.07);
        
        return {
          ...entity,
          personalization_score: personalizationScore,
          reason: this.getPersonalizationReason(userInterest, timePattern, entity)
        };
      });

      // Apply diversity injection to prevent same type domination
      const diverseEntities = this.injectDiversity(scoredEntities, limit);
      
      return diverseEntities
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting personalized entities:', error);
      return this.getPopularEntities(limit);
    }
  }

  // Inject diversity to prevent filter bubbles
  private injectDiversity(entities: PersonalizedEntity[], limit: number): PersonalizedEntity[] {
    const typeCount: { [key: string]: number } = {};
    const maxPerType = Math.max(1, Math.floor(limit / 2)); // Max 50% of same type
    const result: PersonalizedEntity[] = [];
    
    // Sort by score first
    const sorted = entities.sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0));
    
    for (const entity of sorted) {
      const currentTypeCount = typeCount[entity.type] || 0;
      
      if (currentTypeCount < maxPerType || result.length < limit) {
        result.push(entity);
        typeCount[entity.type] = currentTypeCount + 1;
        
        if (result.length >= limit) break;
      }
    }
    
    return result;
  }

  private getPersonalizationReason(userInterest: any, timePattern: any, entity: any): string {
    if (entity.seasonal_boost > 0) return 'Perfect for this season';
    if (entity.geographic_boost > 0) return 'Popular in your area';
    if (entity.view_velocity > 10) return 'Rapidly trending';
    if (timePattern?.activity_score > 0) return 'Based on your schedule';
    if (userInterest?.interest_score > 5) return 'Matches your interests';
    return 'Trending now';
  }

  // Apply seasonal boosts based on current date
  private async applySeasonalBoosts() {
    try {
      const now = new Date();
      const month = now.getMonth(); // 0-11
      
      // Holiday seasons
      let seasonalType = '';
      if (month === 11 || month === 0) seasonalType = 'winter_holidays';
      else if (month >= 2 && month <= 4) seasonalType = 'spring';
      else if (month >= 5 && month <= 7) seasonalType = 'summer';
      else if (month >= 8 && month <= 10) seasonalType = 'fall';
      
      // Apply boosts based on entity metadata and seasonal relevance
      const boostQueries = [];
      
      if (seasonalType === 'winter_holidays') {
        boostQueries.push(
          supabase
            .from('entities')
            .update({ seasonal_boost: 1.5 })
            .or('metadata->>category.ilike.%holiday%,metadata->>tags.cs.["christmas","winter","holiday"]')
        );
      }
      
      if (seasonalType === 'summer') {
        boostQueries.push(
          supabase
            .from('entities')
            .update({ seasonal_boost: 1.3 })
            .or('type.eq.place,metadata->>category.ilike.%outdoor%,metadata->>tags.cs.["summer","beach","travel"]')
        );
      }
      
      // Execute boost updates
      await Promise.all(boostQueries);
    } catch (error) {
      console.error('Error applying seasonal boosts:', error);
    }
  }

  // Enhanced trending entities with velocity and time-decay
  async getTrendingEntitiesByCategory(category?: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      let query = supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false);

      if (category && this.isValidEntityType(category)) {
        query = query.eq('type', category as 'book' | 'movie' | 'place' | 'product' | 'food');
      }

      // Order by enhanced trending score with velocity consideration
      const { data: entities } = await query
        .order('trending_score', { ascending: false })
        .order('view_velocity', { ascending: false })
        .limit(limit);

      if (!entities) return [];

      return entities.map(entity => ({
        ...entity,
        reason: entity.view_velocity > 5 ? 'Rapidly trending' : 'Trending this week'
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
        query = query.eq('type', category as 'book' | 'movie' | 'place' | 'product' | 'food');
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

  private isValidEntityType(category: string): category is 'book' | 'movie' | 'place' | 'product' | 'food' {
    const validTypes = ['book', 'movie', 'place', 'product', 'food'];
    return validTypes.includes(category);
  }

  // Background job to update all trending scores
  async updateAllTrendingScores(): Promise<number> {
    try {
      const { data: result } = await supabase.rpc('update_all_trending_scores');
      console.log(`Updated trending scores for ${result} entities`);
      return result || 0;
    } catch (error) {
      console.error('Error updating all trending scores:', error);
      return 0;
    }
  }
}

export const enhancedExploreService = new EnhancedExploreService();
