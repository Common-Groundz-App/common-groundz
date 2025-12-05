import { supabase } from '@/integrations/supabase/client';

export interface JourneyEntity {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
}

export interface JourneyStory {
  headline: string;
  description: string;
  sentiment_change: string | null;
  evidence_quote: string | null;
}

export interface JourneyRecommendation {
  id: string;
  fromEntity: JourneyEntity;
  toEntity: JourneyEntity;
  transitionType: 'upgrade' | 'alternative' | 'complementary';
  weightedScore: number;
  story: JourneyStory;
  confidence: 'high' | 'medium' | 'low';
  consensusCount: number;
}

export interface RecommendationMetadata {
  richness_mode: 'RICH' | 'MODERATE' | 'SPARSE';
  similar_users_found: number;
  journeys_analyzed: number;
  global_relationships_available: number;
  entity_specific: boolean;
}

export interface JourneyRecommendationResponse {
  recommendations: JourneyRecommendation[];
  metadata: RecommendationMetadata;
}

class JourneyRecommendationService {
  private async callEdgeFunction(params: {
    userId: string;
    entityId?: string;
    transitionType?: 'upgrade' | 'alternative' | 'complementary';
    limit?: number;
  }): Promise<JourneyRecommendationResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('get-personalized-transitions', {
        body: params
      });

      if (error) {
        console.error('[JourneyRecommendationService] Edge function error:', error);
        return { recommendations: [], metadata: this.getEmptyMetadata() };
      }

      // Transform snake_case response to camelCase
      const recommendations: JourneyRecommendation[] = (data.recommendations || []).map((rec: any) => ({
        id: rec.id,
        fromEntity: rec.from_entity,
        toEntity: rec.to_entity,
        transitionType: rec.transition_type,
        weightedScore: rec.weighted_score,
        story: rec.story,
        confidence: rec.confidence,
        consensusCount: rec.consensus_count
      }));

      return {
        recommendations,
        metadata: data.metadata || this.getEmptyMetadata()
      };
    } catch (err) {
      console.error('[JourneyRecommendationService] Error calling edge function:', err);
      return { recommendations: [], metadata: this.getEmptyMetadata() };
    }
  }

  private getEmptyMetadata(): RecommendationMetadata {
    return {
      richness_mode: 'SPARSE',
      similar_users_found: 0,
      journeys_analyzed: 0,
      global_relationships_available: 0,
      entity_specific: false
    };
  }

  /**
   * Get journey recommendations based on user's current inventory (My Stuff)
   */
  async getRecommendationsForMyStuff(
    userId: string,
    limit: number = 10
  ): Promise<JourneyRecommendationResponse> {
    console.log('[JourneyRecommendationService] Getting recommendations for My Stuff', { userId, limit });
    return this.callEdgeFunction({ userId, limit });
  }

  /**
   * Get journey recommendations for a specific entity (entity detail page)
   */
  async getRecommendationsForEntity(
    userId: string,
    entityId: string,
    limit: number = 5
  ): Promise<JourneyRecommendationResponse> {
    console.log('[JourneyRecommendationService] Getting recommendations for entity', { userId, entityId, limit });
    return this.callEdgeFunction({ userId, entityId, limit });
  }

  /**
   * Get only upgrade suggestions
   */
  async getUpgradeSuggestions(
    userId: string,
    limit: number = 5
  ): Promise<JourneyRecommendationResponse> {
    console.log('[JourneyRecommendationService] Getting upgrade suggestions', { userId, limit });
    return this.callEdgeFunction({ userId, transitionType: 'upgrade', limit });
  }

  /**
   * Get only alternative suggestions
   */
  async getAlternatives(
    userId: string,
    limit: number = 5
  ): Promise<JourneyRecommendationResponse> {
    console.log('[JourneyRecommendationService] Getting alternatives', { userId, limit });
    return this.callEdgeFunction({ userId, transitionType: 'alternative', limit });
  }

  /**
   * Get complementary product suggestions
   */
  async getComplementary(
    userId: string,
    limit: number = 5
  ): Promise<JourneyRecommendationResponse> {
    console.log('[JourneyRecommendationService] Getting complementary', { userId, limit });
    return this.callEdgeFunction({ userId, transitionType: 'complementary', limit });
  }

  /**
   * Get confidence label for display
   */
  getConfidenceLabel(confidence: 'high' | 'medium' | 'low'): string {
    switch (confidence) {
      case 'high': return 'Highly personalized';
      case 'medium': return 'Based on similar users';
      case 'low': return 'Community suggestion';
    }
  }

  /**
   * Get transition type display label
   */
  getTransitionTypeLabel(type: 'upgrade' | 'alternative' | 'complementary'): string {
    switch (type) {
      case 'upgrade': return 'Upgrade';
      case 'alternative': return 'Alternative';
      case 'complementary': return 'Pairs well';
    }
  }
}

export const journeyRecommendationService = new JourneyRecommendationService();
