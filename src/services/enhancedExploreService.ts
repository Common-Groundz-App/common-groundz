import { supabase } from '@/integrations/supabase/client';
import { TRENDING_V2_BOUND } from '@/services/trending/trendingV2';


export interface PersonalizedEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  image_url?: string;
  venue?: string;
  metadata?: any;
  personalization_score?: number;
  trending_score_v2?: number;
  view_velocity?: number;
  is_hidden_gem?: boolean;
  reason?: string;
  geographic_boost?: number;
  seasonal_boost?: number;
  averageRating?: number;
  reviewCount?: number;
  recommendationCount?: number;
  circleRecommendationCount?: number;
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
  
  // Enrich entities with rating and review data using materialized view
  private async enrichWithRatingData(entities: any[], userId?: string): Promise<PersonalizedEntity[]> {
    try {
      if (entities.length === 0) return [];
      
      const entityIds = entities.map(e => e.id);
      
      // Fetch cached stats from materialized view
      const { data: statsData } = await supabase
        .from('entity_stats_v2')
        .select('entity_id, recommendation_count, review_count, average_rating')
        .in('entity_id', entityIds);
      
      const statsMap = new Map(
        statsData?.map(s => [s.entity_id, s]) || []
      );
      
      // Batch-fetch circle counts if authenticated
      let circleCountsMap = new Map<string, number>();
      if (userId) {
        const { data: circleData } = await supabase.rpc('get_circle_recommendation_counts_batch', {
          p_entity_ids: entityIds,
          p_user_id: userId
        });
        circleCountsMap = new Map(
          circleData?.map(c => [c.entity_id, c.circle_count]) || []
        );
      }
      
      // Enrich entities from the single canonical public aggregate plus Circle data.
      return entities.map(entity => {
        const stats = statsMap.get(entity.id);
        
        return {
          ...entity,
          averageRating: stats?.average_rating,
          reviewCount: stats?.review_count || 0,
          recommendationCount: stats?.recommendation_count || 0,
          circleRecommendationCount: circleCountsMap.get(entity.id) || 0
        };
      });
    } catch (error) {
      console.error('Error enriching entities with rating data:', error);
      return entities.map(entity => ({
        ...entity,
        averageRating: undefined,
        reviewCount: 0,
        recommendationCount: 0,
        circleRecommendationCount: 0
      }));
    }
  }
  
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
      
      // Phase 4.2B.3: trending scores are computed server-side only. The browser
      // records the interaction (above) and never writes a score.
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

  // Add the missing updateUserInterests method
  private async updateUserInterests(
    userId: string,
    entityType: string,
    category: string,
    scoreIncrement: number
  ) {
    try {
      // Check if user interest already exists
      const { data: existing, error: fetchError } = await supabase
        .from('user_interests')
        .select('*')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('category', category)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching user interest:', fetchError);
        return;
      }

      if (existing) {
        // Update existing interest
        await supabase
          .from('user_interests')
          .update({
            interest_score: existing.interest_score + scoreIncrement,
            interaction_count: existing.interaction_count + 1,
            last_interaction: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new interest
        await supabase
          .from('user_interests')
          .insert({
            user_id: userId,
            entity_type: entityType,
            category: category,
            interest_score: scoreIncrement,
            interaction_count: 1,
            last_interaction: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error updating user interests:', error);
    }
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
      const { data: existing, error: fetchError } = await supabase
        .from('user_activity_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('category', category)
        .eq('time_of_day', timeOfDay)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching activity pattern:', fetchError);
        return;
      }

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


  // Enhanced personalized featured entities with discovery integration
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

      // Get entities with enhanced scoring (seasonal boosts applied by background job)
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
        .order('trending_score_v2', { ascending: false })
        .order('id', { ascending: true })
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
        // Phase 4.2B.3: v2 trending is bounded [0, 1.2]; normalise to [0, 1]
        // before blending so existing weights keep their meaning.
        const trendingScore = (entity.trending_score_v2 || 0) / TRENDING_V2_BOUND;
        const velocityBoost = (entity.view_velocity || 0) * 0.1;
        const geographicBoost = entity.geographic_boost || 0;
        const seasonalBoost = entity.seasonal_boost || 0;
        
        // Enhanced personalization with recency bias
        const recencyBoost = this.calculateRecencyBoost(entity.created_at);
        
        const personalizationScore = 
          (interestScore * 0.30) + 
          (trendingScore * 0.20) + 
          (temporalBoost * 0.15) + 
          (velocityBoost * 0.10) + 
          (geographicBoost * 0.08) + 
          (seasonalBoost * 0.07) + 
          (recencyBoost * 0.10);
        
        return {
          ...entity,
          personalization_score: personalizationScore,
          reason: this.getEnhancedPersonalizationReason(userInterest, timePattern, entity, recencyBoost)
        };
      });

      // Apply diversity injection to prevent same type domination
      const diverseEntities = this.injectDiversity(scoredEntities, limit);
      
      // Enrich with rating data before returning
      const enrichedEntities = await this.enrichWithRatingData(diverseEntities, userId);
      
      return enrichedEntities
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting personalized entities:', error);
      return this.getPopularEntities(limit);
    }
  }

  // Calculate recency boost for new entities
  private calculateRecencyBoost(createdAt: string): number {
    const entityDate = new Date(createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - entityDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 7) return 1.0; // New this week
    if (daysDiff <= 14) return 0.5; // Recent
    if (daysDiff <= 30) return 0.2; // This month
    return 0; // Older
  }

  // Enhanced personalization reason with more context
  private getEnhancedPersonalizationReason(userInterest: any, timePattern: any, entity: any, recencyBoost: number): string {
    if (recencyBoost >= 1.0) return 'New this week';
    if (entity.seasonal_boost > 0) return 'Perfect for this season';
    if (entity.geographic_boost > 0) return 'Popular in your area';
    if (entity.view_velocity > 10) return 'Rapidly trending';
    if (timePattern?.activity_score > 0) {
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 11) return 'Perfect for morning';
      if (hour >= 17 && hour <= 22) return 'Great for tonight';
      return 'Based on your schedule';
    }
    if (userInterest?.interest_score > 5) return 'Matches your interests';
    return 'Trending now';
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

      // Order by v2 trending score, then velocity, then id (deterministic)
      const { data: entities } = await query
        .order('trending_score_v2', { ascending: false })
        .order('view_velocity', { ascending: false })
        .order('id', { ascending: true })
        .limit(limit);

      if (!entities) return [];

      const entitiesWithReason = entities.map(entity => ({
        ...entity,
        reason: entity.view_velocity > 5 ? 'Rapidly trending' : 'Trending this week'
      }));

      // Enrich with rating data
      return await this.enrichWithRatingData(entitiesWithReason);
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
        .select('*')
        .eq('is_deleted', false)
        .lt('recent_views_24h', 50); // Low views

      if (category && this.isValidEntityType(category)) {
        query = query.eq('type', category as 'book' | 'movie' | 'place' | 'product' | 'food');
      }

      const { data: entities } = await query.limit(limit * 2);

      if (!entities || entities.length === 0) return [];

      // Canonical public reviews for these entities (global surface population)
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('user_id, entity_id, rating, latest_rating, is_recommended, created_at')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .in('entity_id', entities.map(e => e.id))
        .order('created_at', { ascending: false });

      const byEntity = new Map<string, { count: number; total: number }>();
      const seen = new Set<string>();
      ((reviewRows || []) as Array<{ user_id: string; entity_id: string; rating: number | null; latest_rating: number | null }>).forEach(r => {
        const key = `${r.user_id}:${r.entity_id}`;
        if (seen.has(key)) return; // canonical: latest per user+entity
        seen.add(key);
        const entry = byEntity.get(r.entity_id) || { count: 0, total: 0 };
        entry.count += 1;
        entry.total += r.latest_rating ?? r.rating ?? 0;
        byEntity.set(r.entity_id, entry);
      });

      // Filter entities with good ratings but low visibility
      const hiddenGems = entities
        .filter(entity => {
          const agg = byEntity.get(entity.id);
          if (!agg || agg.count === 0) return false;
          return (agg.total / agg.count) >= 4.0;
        })
        .slice(0, limit);

      const hiddenGemsWithReason = hiddenGems.map(entity => ({
        ...entity,
        is_hidden_gem: true,
        reason: 'Hidden gem - highly rated'
      }));

      // Enrich with rating data
      return await this.enrichWithRatingData(hiddenGemsWithReason);
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

      if (!entities) return [];

      const entitiesWithReason = entities.map(entity => ({
        ...entity,
        reason: 'Popular choice'
      }));

      // Enrich with rating data
      return await this.enrichWithRatingData(entitiesWithReason);
    } catch (error) {
      console.error('Error getting popular entities:', error);
      return [];
    }
  }

  private isValidEntityType(category: string): category is 'book' | 'movie' | 'place' | 'product' | 'food' {
    const validTypes = ['book', 'movie', 'place', 'product', 'food'];
    return validTypes.includes(category);
  }

  // Phase 4.2B.3: trending score refreshes are server-only (scheduled job calling
  // the `update-trending-scores` function). The client never triggers them.
}

export const enhancedExploreService = new EnhancedExploreService();
