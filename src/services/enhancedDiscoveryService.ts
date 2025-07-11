
import { supabase } from '@/integrations/supabase/client';
import { discoveryService, DiscoveryCollection } from './discoveryService';
import { advancedPersonalizationService, PersonalizationContext } from './advancedPersonalizationService';
import { collaborativeFilteringService } from './collaborativeFilteringService';
import { socialIntelligenceService } from './socialIntelligenceService';
import { PersonalizedEntity } from './enhancedExploreService';

export class EnhancedDiscoveryService {

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
        enhancedCollections.unshift({
          title: 'Because You Liked',
          entities: collaborativeRecs.map(rec => ({
            ...rec,
            reason: rec.reason || 'Users like you also enjoyed this'
          })),
          type: 'social',
          reason: 'Based on users with similar tastes'
        });
      }

      // Add social intelligence collection
      if (socialRecs.length > 0) {
        enhancedCollections.unshift({
          title: 'Your Network Loves',
          entities: socialRecs.map(rec => ({
            ...rec,
            reason: rec.reason || 'Popular in your extended network'
          })),
          type: 'social',
          reason: 'Trending among people in your network'
        });
      }

      // Add influencer recommendations
      if (influencerRecs.length > 0) {
        enhancedCollections.unshift({
          title: 'Influencer Picks',
          entities: influencerRecs.map(rec => ({
            ...rec,
            reason: rec.reason || 'Recommended by trusted reviewers'
          })),
          type: 'social',
          reason: 'Curated by influential users you follow'
        });
      }

      // Enhance existing collections with better explanations
      enhancedCollections.forEach(collection => {
        collection.entities = collection.entities.map(entity => ({
          ...entity,
          reason: this.enhanceReasonWithConfidence(entity.reason, entity.personalization_score)
        }));
      });

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

      // Convert to PersonalizedEntity format with enhanced reasons
      return advancedRecs.map(rec => ({
        ...rec,
        reason: this.generateSmartReason(rec.algorithm, rec.confidenceScore, rec.explanation)
      }));

    } catch (error) {
      console.error('Error getting smart for you recommendations:', error);
      // Fall back to basic for you recommendations
      return discoveryService.getForYouRecommendations(userId, limit);
    }
  }

  // Get quality-filtered new this week recommendations
  async getQualityNewThisWeek(limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      // Get basic new this week
      const newEntities = await discoveryService.getNewThisWeek(limit * 2);

      if (newEntities.length === 0) return [];

      // Get quality scores for these entities
      const entityIds = newEntities.map(e => e.id);
      const { data: qualityScores } = await supabase
        .from('recommendation_quality_scores')
        .select('entity_id, quality_score, social_proof_score, spam_score')
        .in('entity_id', entityIds);

      // Enhance with quality information
      const qualityEnhanced = newEntities.map(entity => {
        const quality = qualityScores?.find(q => q.entity_id === entity.id);
        const qualityScore = quality?.quality_score || 0.5;
        const spamScore = quality?.spam_score || 0;
        const socialProof = quality?.social_proof_score || 0;

        // Filter out potential spam
        if (spamScore > 0.7) return null;

        return {
          ...entity,
          personalization_score: qualityScore * (1 + socialProof) * (1 - spamScore),
          reason: this.enhanceNewReasonWithQuality(qualityScore, socialProof)
        };
      }).filter(Boolean) as PersonalizedEntity[];

      return qualityEnhanced
        .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0))
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting quality new this week:', error);
      return discoveryService.getNewThisWeek(limit);
    }
  }

  // Calculate recommendation quality scores in background
  async calculateQualityScores(entityIds: string[]) {
    try {
      for (const entityId of entityIds) {
        const qualityData = await this.calculateEntityQuality(entityId);
        
        await supabase
          .from('recommendation_quality_scores')
          .upsert({
            entity_id: entityId,
            ...qualityData
          }, {
            onConflict: 'entity_id'
          });
      }
    } catch (error) {
      console.error('Error calculating quality scores:', error);
    }
  }

  // Calculate quality metrics for an entity
  private async calculateEntityQuality(entityId: string) {
    try {
      // Get entity recommendations and engagement
      const { data: entityData } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations(rating, view_count, created_at),
          recommendation_likes(created_at)
        `)
        .eq('id', entityId)
        .single();

      if (!entityData) return { quality_score: 0, spam_score: 0, relevance_score: 0, freshness_score: 0, social_proof_score: 0 };

      const recommendations = entityData.recommendations || [];
      const likes = entityData.recommendation_likes || [];

      // Quality score based on ratings
      const avgRating = recommendations.length > 0 
        ? recommendations.reduce((sum: number, rec: any) => sum + rec.rating, 0) / recommendations.length
        : 0;
      const qualityScore = avgRating / 5;

      // Spam detection based on patterns
      const spamScore = this.detectSpamPatterns(recommendations);

      // Relevance based on view counts and ratings consistency
      const totalViews = recommendations.reduce((sum: number, rec: any) => sum + (rec.view_count || 0), 0);
      const relevanceScore = Math.min(totalViews / 100, 1) * (1 - this.calculateRatingVariance(recommendations));

      // Freshness based on recency
      const mostRecentRec = recommendations.reduce((latest: any, rec: any) => 
        new Date(rec.created_at) > new Date(latest.created_at || 0) ? rec : latest
      , {});
      const daysSinceLatest = mostRecentRec.created_at 
        ? (Date.now() - new Date(mostRecentRec.created_at).getTime()) / (1000 * 60 * 60 * 24)
        : 365;
      const freshnessScore = Math.max(0, 1 - daysSinceLatest / 30); // Decay over 30 days

      // Social proof based on likes and engagement
      const socialProofScore = Math.min(likes.length / 10, 1); // Scale to 0-1

      return {
        quality_score: qualityScore,
        spam_score: spamScore,
        relevance_score: relevanceScore,
        freshness_score: freshnessScore,
        social_proof_score: socialProofScore
      };

    } catch (error) {
      console.error('Error calculating entity quality:', error);
      return { quality_score: 0, spam_score: 0, relevance_score: 0, freshness_score: 0, social_proof_score: 0 };
    }
  }

  // Detect spam patterns in recommendations
  private detectSpamPatterns(recommendations: any[]): number {
    if (recommendations.length === 0) return 0;

    let spamSignals = 0;
    const totalSignals = 4;

    // Signal 1: Too many perfect ratings
    const perfectRatings = recommendations.filter(r => r.rating === 5).length;
    if (perfectRatings / recommendations.length > 0.8) spamSignals++;

    // Signal 2: Very recent burst of activity
    const recentRecs = recommendations.filter(r => 
      new Date(r.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    if (recentRecs.length > 5) spamSignals++;

    // Signal 3: Low view counts with high ratings
    const lowViewHighRating = recommendations.filter(r => 
      (r.view_count || 0) < 5 && r.rating >= 4
    );
    if (lowViewHighRating.length / recommendations.length > 0.6) spamSignals++;

    // Signal 4: Identical ratings from multiple users
    const ratingCounts = new Map();
    recommendations.forEach(r => {
      const count = ratingCounts.get(r.rating) || 0;
      ratingCounts.set(r.rating, count + 1);
    });
    const maxCount = Math.max(...Array.from(ratingCounts.values()));
    if (maxCount / recommendations.length > 0.7) spamSignals++;

    return spamSignals / totalSignals;
  }

  // Calculate rating variance to detect fake/manipulated ratings
  private calculateRatingVariance(recommendations: any[]): number {
    if (recommendations.length < 2) return 0;

    const ratings = recommendations.map(r => r.rating);
    const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const variance = ratings.reduce((sum, rating) => sum + Math.pow(rating - mean, 2), 0) / ratings.length;
    
    return Math.min(variance / 4, 1); // Normalize to 0-1 (max variance is 4 for ratings 1-5)
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

  private enhanceNewReasonWithQuality(qualityScore: number, socialProof: number): string {
    if (socialProof > 0.7) return 'New & highly popular';
    if (qualityScore > 0.8) return 'New & highly rated';
    if (qualityScore > 0.6) return 'New & well-received';
    return 'New this week';
  }
}

export const enhancedDiscoveryService = new EnhancedDiscoveryService();
