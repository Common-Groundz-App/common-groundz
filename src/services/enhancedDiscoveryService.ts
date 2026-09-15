import { supabase } from '@/integrations/supabase/client';
import { discoveryService, DiscoveryCollection } from './discoveryService';
import { advancedPersonalizationService, PersonalizationContext } from './advancedPersonalizationService';
import { collaborativeFilteringService } from './collaborativeFilteringService';
import { socialIntelligenceService } from './socialIntelligenceService';
import { PersonalizedEntity } from './enhancedExploreService';

export class EnhancedDiscoveryService {

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

  // Get enhanced discovery collections with advanced algorithms
  async getEnhancedDiscoveryCollections(userId?: string): Promise<DiscoveryCollection[]> {
    try {
      if (!userId) {
        // Fall back to basic discovery for non-authenticated users
        return discoveryService.getAllDiscoveryCollections();
      }

      // Get current context
      const context: PersonalizationContext = {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        season: this.getCurrentSeason(),
        recentActivity: []
      };

      // Get advanced recommendations from multiple algorithms
      const [
        basicCollections,
        collaborativeRecs,
        socialRecs,
        influencerRecs,
        advancedRecs
      ] = await Promise.all([
        discoveryService.getAllDiscoveryCollections(userId),
        collaborativeFilteringService.getCollaborativeRecommendations(userId, 4),
        socialIntelligenceService.getExtendedSocialRecommendations(userId, 4),
        socialIntelligenceService.getInfluencerRecommendations(userId, 4),
        advancedPersonalizationService.getAdvancedRecommendations(userId, context, 6)
      ]);

      const enhancedCollections: DiscoveryCollection[] = [...basicCollections];

      // Add collaborative filtering collection if we have recommendations
      if (collaborativeRecs.length > 0) {
        const enrichedCollaborativeRecs = await this.enrichWithRatingData(collaborativeRecs, userId);
        enhancedCollections.unshift({
          title: 'Because You Liked',
          entities: enrichedCollaborativeRecs.map(rec => ({
            ...rec,
            reason: rec.reason || 'Users like you also enjoyed this'
          })),
          type: 'social',
          reason: 'Based on users with similar tastes'
        });
      }

      // Add social intelligence collection
      if (socialRecs.length > 0) {
        const enrichedSocialRecs = await this.enrichWithRatingData(socialRecs, userId);
        enhancedCollections.unshift({
          title: 'Your Network Loves',
          entities: enrichedSocialRecs.map(rec => ({
            ...rec,
            reason: rec.reason || 'Popular in your extended network'
          })),
          type: 'social',
          reason: 'Trending among people in your network'
        });
      }

      // Add influencer recommendations
      if (influencerRecs.length > 0) {
        const enrichedInfluencerRecs = await this.enrichWithRatingData(influencerRecs, userId);
        enhancedCollections.unshift({
          title: 'Influencer Picks',
          entities: enrichedInfluencerRecs.map(rec => ({
            ...rec,
            reason: rec.reason || 'Recommended by trusted reviewers'
          })),
          type: 'social',
          reason: 'Curated by influential users you follow'
        });
      }

      // Enhance existing collections with better explanations and rating data
      for (const collection of enhancedCollections) {
        if (collection.entities && collection.entities.length > 0) {
          const enrichedEntities = await this.enrichWithRatingData(collection.entities, userId);
          collection.entities = enrichedEntities.map(entity => ({
            ...entity,
            reason: this.enhanceReasonWithConfidence(entity.reason, entity.personalization_score)
          }));
        }
      }

      return enhancedCollections;

    } catch (error) {
      console.error('Error getting enhanced discovery collections:', error);
      // Fall back to basic discovery
      return discoveryService.getAllDiscoveryCollections(userId);
    }
  }

  // Get smart "For You" recommendations using ensemble methods
  async getSmartForYouRecommendations(userId: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const context: PersonalizationContext = {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        season: this.getCurrentSeason(),
        recentActivity: []
      };

      // Get recommendations from advanced personalization service
      const advancedRecs = await advancedPersonalizationService.getAdvancedRecommendations(
        userId,
        context,
        limit
      );

      // Convert to PersonalizedEntity format with enhanced reasons and enrich with rating data
      const entitiesWithReasons = advancedRecs.map(rec => ({
        ...rec,
        reason: this.generateSmartReason(rec.algorithm, rec.confidenceScore, rec.explanation)
      }));

      return await this.enrichWithRatingData(entitiesWithReasons, userId);

    } catch (error) {
      console.error('Error getting smart for you recommendations:', error);
      // Fall back to basic for you recommendations
      return discoveryService.getForYouRecommendations(userId, limit);
    }
  }

  // Get new this week recommendations (recency-ordered, reviewer-evidence gated upstream)
  async getQualityNewThisWeek(limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const newEntities = await discoveryService.getNewThisWeek(limit);

      if (newEntities.length === 0) return [];

      return await this.enrichWithRatingData(newEntities);
    } catch (error) {
      console.error('Error getting new this week:', error);
      return discoveryService.getNewThisWeek(limit);
    }
  }


  // Helper methods
  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private enhanceReasonWithConfidence(reason?: string, score?: number): string {
    if (!reason) return 'Recommended for you';
    
    if (score && score > 15) {
      return reason + ' (High confidence)';
    } else if (score && score > 10) {
      return reason + ' (Good match)';
    }
    
    return reason;
  }

  private generateSmartReason(algorithm: string, confidence: number, explanation: string): string {
    const confidenceText = confidence > 0.8 ? 'Highly recommended' :
                          confidence > 0.6 ? 'Good match' :
                          confidence > 0.4 ? 'Suggested' : 'You might like';
    
    if (algorithm === 'ensemble') {
      return `${confidenceText}: ${explanation}`;
    }
    
    return explanation || confidenceText;
  }
}

export const enhancedDiscoveryService = new EnhancedDiscoveryService();
