
import { supabase } from '@/integrations/supabase/client';
import { PersonalizedEntity } from './enhancedExploreService';
import { collaborativeFilteringService } from './collaborativeFilteringService';
import { socialIntelligenceService } from './socialIntelligenceService';

export interface PersonalizationContext {
  timeOfDay: number;
  dayOfWeek: number;
  season: string;
  location?: string;
  weatherMood?: string;
  recentActivity: string[];
}

export interface AdvancedRecommendation extends PersonalizedEntity {
  algorithm: string;
  confidenceScore: number;
  explanation: string;
  contextualFactors: string[];
}

export class AdvancedPersonalizationService {

  // Get advanced personalized recommendations using multiple algorithms
  async getAdvancedRecommendations(
    userId: string, 
    context: PersonalizationContext,
    limit: number = 6
  ): Promise<AdvancedRecommendation[]> {
    try {
      // Get recommendations from multiple algorithms
      const [
        collaborativeRecs,
        itemBasedRecs,
        socialRecs,
        influencerRecs,
        contextualRecs,
        temporalRecs
      ] = await Promise.all([
        collaborativeFilteringService.getCollaborativeRecommendations(userId, 4),
        collaborativeFilteringService.getItemBasedRecommendations(userId, 4),
        socialIntelligenceService.getExtendedSocialRecommendations(userId, 4),
        socialIntelligenceService.getInfluencerRecommendations(userId, 4),
        this.getContextualRecommendations(userId, context, 4),
        this.getTemporalRecommendations(userId, context, 4)
      ]);

      // Combine and score recommendations
      const allRecommendations: AdvancedRecommendation[] = [
        ...this.enhanceRecommendations(collaborativeRecs, 'collaborative_filtering', 0.9),
        ...this.enhanceRecommendations(itemBasedRecs, 'item_based_filtering', 0.8),
        ...this.enhanceRecommendations(socialRecs, 'social_network', 0.7),
        ...this.enhanceRecommendations(influencerRecs, 'influencer_based', 0.8),
        ...this.enhanceRecommendations(contextualRecs, 'contextual', 0.6),
        ...this.enhanceRecommendations(temporalRecs, 'temporal', 0.7)
      ];

      // Apply ensemble scoring and deduplication
      const finalRecommendations = this.applyEnsembleScoring(allRecommendations, context);

      // Store explanations for transparency
      await this.storeRecommendationExplanations(userId, finalRecommendations);

      return finalRecommendations.slice(0, limit);

    } catch (error) {
      console.error('Error getting advanced recommendations:', error);
      return [];
    }
  }

  // Get contextual recommendations based on current context
  private async getContextualRecommendations(
    userId: string,
    context: PersonalizationContext,
    limit: number
  ): Promise<PersonalizedEntity[]> {
    try {
      // Learn from user's historical context patterns
      const { data: patterns } = await supabase
        .from('user_behavior_patterns')
        .select('*')
        .eq('user_id', userId)
        .eq('pattern_type', 'contextual')
        .gte('confidence_score', 0.3);

      // Get user's preferred entity types for current context
      let preferredTypes: string[] = [];
      let contextualBoost = 1.0;

      // Time-based preferences
      if (context.timeOfDay >= 6 && context.timeOfDay <= 11) {
        preferredTypes = ['food', 'book', 'place'];
        contextualBoost = 1.2;
      } else if (context.timeOfDay >= 17 && context.timeOfDay <= 22) {
        preferredTypes = ['food', 'movie', 'place'];
        contextualBoost = 1.3;
      }

      // Season-based preferences
      if (context.season === 'summer') {
        preferredTypes = [...preferredTypes, 'place'];
        contextualBoost *= 1.1;
      }

      // Apply learned patterns
      patterns?.forEach(pattern => {
        const patternData = pattern.pattern_data as any;
        if (patternData.preferredTypes) {
          preferredTypes = [...preferredTypes, ...patternData.preferredTypes];
        }
      });

      if (preferredTypes.length === 0) return [];

      // Get entities matching contextual preferences
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('type', preferredTypes)
        .order('trending_score', { ascending: false })
        .limit(limit * 2);

      if (!entities) return [];

      return entities.map(entity => ({
        ...entity,
        personalization_score: (entity.trending_score || 0) * contextualBoost,
        reason: this.getContextualReason(context, entity.type)
      })).slice(0, limit);

    } catch (error) {
      console.error('Error getting contextual recommendations:', error);
      return [];
    }
  }

  // Get temporal recommendations based on user's time patterns
  private async getTemporalRecommendations(
    userId: string,
    context: PersonalizationContext,
    limit: number
  ): Promise<PersonalizedEntity[]> {
    try {
      // Get user's activity patterns for current time
      const { data: timePatterns } = await supabase
        .from('user_activity_patterns')
        .select('*')
        .eq('user_id', userId)
        .or(`time_of_day.eq.${context.timeOfDay},day_of_week.eq.${context.dayOfWeek}`)
        .order('activity_score', { ascending: false });

      if (!timePatterns || timePatterns.length === 0) return [];

      // Get entities matching temporal patterns
      const preferredTypes = timePatterns.map(p => p.entity_type);
      const preferredCategories = timePatterns.map(p => p.category);

      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('type', preferredTypes)
        .order('trending_score', { ascending: false })
        .limit(limit);

      if (!entities) return [];

      return entities.map(entity => {
        const pattern = timePatterns.find(p => p.entity_type === entity.type);
        const temporalScore = (pattern?.activity_score || 0) * (entity.trending_score || 0);

        return {
          ...entity,
          personalization_score: temporalScore,
          reason: `You usually enjoy ${entity.type} at this time`
        };
      });

    } catch (error) {
      console.error('Error getting temporal recommendations:', error);
      return [];
    }
  }

  // Enhance recommendations with algorithm and confidence info
  private enhanceRecommendations(
    recommendations: PersonalizedEntity[],
    algorithm: string,
    baseConfidence: number
  ): AdvancedRecommendation[] {
    return recommendations.map(rec => ({
      ...rec,
      algorithm,
      confidenceScore: baseConfidence * Math.min(1, (rec.personalization_score || 0) / 10),
      explanation: rec.reason || `Recommended by ${algorithm.replace('_', ' ')}`,
      contextualFactors: this.extractContextualFactors(rec)
    }));
  }

  // Apply ensemble scoring to combine multiple algorithms
  private applyEnsembleScoring(
    recommendations: AdvancedRecommendation[],
    context: PersonalizationContext
  ): AdvancedRecommendation[] {
    // Group by entity ID to handle duplicates
    const entityGroups = new Map<string, AdvancedRecommendation[]>();
    
    recommendations.forEach(rec => {
      const existing = entityGroups.get(rec.id) || [];
      existing.push(rec);
      entityGroups.set(rec.id, existing);
    });

    // Calculate ensemble scores
    const ensembleRecs: AdvancedRecommendation[] = [];

    entityGroups.forEach((recs, entityId) => {
      if (recs.length === 0) return;

      // Take the best recommendation as base
      const bestRec = recs.reduce((best, current) => 
        current.confidenceScore > best.confidenceScore ? current : best
      );

      // Calculate weighted ensemble score
      let ensembleScore = 0;
      let totalWeight = 0;
      const algorithms: string[] = [];
      const factors: string[] = [];

      recs.forEach(rec => {
        const weight = rec.confidenceScore;
        ensembleScore += (rec.personalization_score || 0) * weight;
        totalWeight += weight;
        algorithms.push(rec.algorithm);
        factors.push(...rec.contextualFactors);
      });

      ensembleScore = totalWeight > 0 ? ensembleScore / totalWeight : 0;

      // Boost score for multiple algorithm agreement
      const algorithmBonus = Math.min(recs.length * 0.1, 0.5);
      ensembleScore *= (1 + algorithmBonus);

      ensembleRecs.push({
        ...bestRec,
        personalization_score: ensembleScore,
        confidenceScore: Math.min(bestRec.confidenceScore + algorithmBonus, 1),
        algorithm: algorithms.length > 1 ? 'ensemble' : bestRec.algorithm,
        explanation: this.generateEnsembleExplanation(algorithms, bestRec.explanation),
        contextualFactors: [...new Set(factors)]
      });
    });

    return ensembleRecs
      .sort((a, b) => (b.personalization_score || 0) - (a.personalization_score || 0));
  }

  // Store recommendation explanations for transparency
  private async storeRecommendationExplanations(
    userId: string,
    recommendations: AdvancedRecommendation[]
  ) {
    try {
      const explanations = recommendations.map(rec => ({
        user_id: userId,
        entity_id: rec.id,
        explanation_type: rec.algorithm.includes('social') ? 'social' : 
                         rec.algorithm.includes('collaborative') ? 'collaborative' :
                         rec.algorithm.includes('contextual') ? 'contextual' : 'content',
        explanation_text: rec.explanation,
        confidence_score: rec.confidenceScore,
        algorithm_used: rec.algorithm
      }));

      await supabase
        .from('recommendation_explanations')
        .upsert(explanations, {
          onConflict: 'user_id,entity_id'
        });
    } catch (error) {
      console.error('Error storing recommendation explanations:', error);
    }
  }

  // Generate contextual reason based on context
  private getContextualReason(context: PersonalizationContext, entityType: string): string {
    const timeReasons = {
      morning: 'Perfect for morning',
      afternoon: 'Great for afternoon',
      evening: 'Ideal for tonight',
      night: 'Good late night choice'
    };

    const timeSlot = context.timeOfDay >= 6 && context.timeOfDay <= 11 ? 'morning' :
                    context.timeOfDay >= 12 && context.timeOfDay <= 16 ? 'afternoon' :
                    context.timeOfDay >= 17 && context.timeOfDay <= 22 ? 'evening' : 'night';

    return timeReasons[timeSlot];
  }

  // Extract contextual factors from recommendation
  private extractContextualFactors(rec: PersonalizedEntity): string[] {
    const factors: string[] = [];
    
    if (rec.reason?.includes('trending')) factors.push('trending');
    if (rec.reason?.includes('friends')) factors.push('social');
    if (rec.reason?.includes('time') || rec.reason?.includes('morning') || rec.reason?.includes('tonight')) {
      factors.push('temporal');
    }
    if (rec.seasonal_boost && rec.seasonal_boost > 0) factors.push('seasonal');
    if (rec.geographic_boost && rec.geographic_boost > 0) factors.push('location');
    
    return factors;
  }

  // Generate explanation for ensemble recommendations
  private generateEnsembleExplanation(algorithms: string[], baseExplanation: string): string {
    if (algorithms.length === 1) return baseExplanation;
    
    const algorithmNames = algorithms.map(alg => 
      alg.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
    
    return `Multiple factors suggest this: ${algorithmNames.slice(0, 2).join(' & ')}${
      algorithms.length > 2 ? ` +${algorithms.length - 2} more` : ''
    }`;
  }

  // Learn from user feedback to improve recommendations
  async learnFromFeedback(
    userId: string,
    entityId: string,
    feedback: 'like' | 'dislike' | 'not_interested',
    algorithm: string
  ) {
    try {
      // Update user behavior patterns based on feedback
      const patternData = {
        feedback_type: feedback,
        entity_id: entityId,
        algorithm: algorithm,
        timestamp: new Date().toISOString()
      };

      await supabase
        .from('user_behavior_patterns')
        .upsert({
          user_id: userId,
          pattern_type: 'feedback',
          pattern_data: patternData,
          confidence_score: feedback === 'like' ? 0.8 : feedback === 'dislike' ? -0.8 : -0.3,
          last_updated: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error learning from feedback:', error);
    }
  }
}

export const advancedPersonalizationService = new AdvancedPersonalizationService();
