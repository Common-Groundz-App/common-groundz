
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

/**
 * Phase 4.2B.3 — collaborative pipeline contract:
 *
 * - Candidate discovery and similarity operate over PUBLIC, published, canonical
 *   reviews only (globally reusable population, same as calculate_user_similarity_v2).
 * - Endorsement reads go through `get_canonical_endorsements_public`, which
 *   canonicalizes (one current review per person per item) BEFORE inspecting
 *   reviews.is_recommended and before any row cap. The client never filters on
 *   the endorsement flag and never caps pre-canonical rows.
 * - Effective rating is used only for scoring/ordering.
 * - The viewer's exclusion set is ALL of the viewer's own reviews (any status or
 *   visibility, including drafts).
 * - calculate_user_similarity_v2 returns NULL when two users share fewer than 3
 *   canonical entities; NULL means "no measured similarity", not 0.
 */

/** Row returned by get_canonical_endorsements_public — already canonical + endorsed. */
interface EndorsementRow {
  user_id: string;
  entity_id: string;
  effective_rating: number;
  created_at: string;
}

/** Raw review row used only for canonicalizing the VIEWER's own reviews (seeds). */
interface RawReview {
  user_id: string;
  entity_id: string;
  rating: number | null;
  latest_rating: number | null;
  is_recommended: boolean | null;
  created_at: string;
}

/** Keep the latest review per (user_id, entity_id). Input must be created_at DESC. */
const canonicalizeOwn = (rows: RawReview[]): RawReview[] => {
  const seen = new Set<string>();
  const out: RawReview[] = [];
  for (const row of rows) {
    const key = `${row.user_id}:${row.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
};

/** All entity ids the viewer has any review record for (any status/visibility, incl. drafts). */
const getViewerReviewedEntityIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('reviews')
    .select('entity_id')
    .eq('user_id', userId)
    .not('entity_id', 'is', null);
  return [...new Set((data || []).map(r => r.entity_id as string))];
};

/** Canonical endorsed reviews by the given authors — canonical-first in SQL. */
const getPublicEndorsements = async (userIds: string[]): Promise<EndorsementRow[]> => {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_canonical_endorsements_public', {
    p_user_ids: userIds
  });
  if (error) {
    console.error('Error fetching canonical endorsements:', error);
    return [];
  }
  return (data || []) as EndorsementRow[];
};

export class CollaborativeFilteringService {

  // Find similar users based on rating patterns (v2 similarity over public canonical reviews)
  async findSimilarUsers(userId: string, limit: number = 10): Promise<UserSimilarity[]> {
    try {
      const entityIds = await getViewerReviewedEntityIds(userId);
      if (entityIds.length === 0) return [];

      // Candidate authors: public published reviews on entities the viewer reviewed
      const { data: candidateUsers } = await supabase
        .from('reviews')
        .select('user_id')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .neq('user_id', userId)
        .in('entity_id', entityIds);

      if (!candidateUsers) return [];

      const uniqueUsers = [...new Set(candidateUsers.map(u => u.user_id))];
      const similarities: UserSimilarity[] = [];

      // Calculate similarity for each candidate user
      for (const candidateUserId of uniqueUsers.slice(0, 50)) { // Limit to prevent timeouts
        const { data: similarityResult } = await supabase
          .rpc('calculate_user_similarity_v2', {
            p_user_a: userId,
            p_user_b: candidateUserId
          });

        // v2 NULL semantics: fewer than 3 shared canonical entities -> no measured
        // similarity. NULL is not 0 and must not pass the threshold.
        if (similarityResult !== null && similarityResult > 0.1) {
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

  // Get collaborative filtering recommendations (things similar people endorse)
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
      const similarityByUser = new Map(similarUsers.map(u => [u.userId, u.similarityScore]));
      const excludedIds = new Set(await getViewerReviewedEntityIds(userId));

      // Canonical endorsed reviews by similar users (canonical-first in SQL)
      const endorsed = (await getPublicEndorsements(similarUserIds))
        .filter(r => !excludedIds.has(r.entity_id));

      if (endorsed.length === 0) return [];

      // Weighted effective rating per entity, weighted by similarity
      const byEntity = new Map<string, { weighted: number; weight: number }>();
      endorsed.forEach(r => {
        const w = similarityByUser.get(r.user_id) || 0;
        if (w <= 0) return;
        const entry = byEntity.get(r.entity_id) || { weighted: 0, weight: 0 };
        entry.weighted += r.effective_rating * w;
        entry.weight += w;
        byEntity.set(r.entity_id, entry);
      });

      const entityIds = [...byEntity.keys()];
      if (entityIds.length === 0) return [];

      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('id', entityIds);

      if (!entities) return [];

      const scoredEntities = entities.map(entity => {
        const agg = byEntity.get(entity.id) || { weighted: 0, weight: 0 };
        const averageWeightedRating = agg.weight > 0 ? agg.weighted / agg.weight : 0;

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

  // Get item-based collaborative filtering recommendations (co-endorsed items)
  async getItemBasedRecommendations(
    userId: string, 
    limit: number = 6
  ): Promise<PersonalizedEntity[]> {
    try {
      // Viewer-endorsed seeds: the viewer's own canonical reviews that resolve to endorsed
      const { data: viewerRows } = await supabase
        .from('reviews')
        .select('user_id, entity_id, rating, latest_rating, is_recommended, created_at')
        .eq('user_id', userId)
        .not('entity_id', 'is', null)
        .order('created_at', { ascending: false });

      const viewerCanonical = canonicalizeOwn((viewerRows || []) as RawReview[]);
      const viewerEndorsed = viewerCanonical
        .filter(r => r.is_recommended === true)
        .sort((a, b) => (b.latest_rating ?? b.rating ?? 0) - (a.latest_rating ?? a.rating ?? 0))
        .slice(0, 10);

      if (viewerEndorsed.length === 0) {
        return [];
      }

      const likedEntityIds = viewerEndorsed.map(e => e.entity_id);
      const excludedIds = new Set(viewerCanonical.map(r => r.entity_id));

      // Co-endorsers: other users whose canonical public review endorses a seed
      // entity (canonical-first in SQL; the endorsement flag is never filtered
      // before canonical selection)
      const { data: coEndorserRows, error: coErr } = await supabase
        .rpc('get_canonical_endorsements_public', {
          p_entity_ids: likedEntityIds
        });

      if (coErr || !coEndorserRows || coEndorserRows.length === 0) return [];

      const coEndorserIds = [...new Set(
        (coEndorserRows as EndorsementRow[])
          .map(r => r.user_id)
          .filter(id => id !== userId)
      )];

      // Other entities those co-endorsers endorse (canonical-first in SQL)
      const otherEndorsed = (await getPublicEndorsements(coEndorserIds))
        .filter(r => !excludedIds.has(r.entity_id));

      if (otherEndorsed.length === 0) return [];

      // Score based on endorser count and effective ratings
      const entityScores = new Map<string, { score: number, count: number }>();
      otherEndorsed.forEach(r => {
        const existing = entityScores.get(r.entity_id);
        if (existing) {
          existing.score += r.effective_rating;
          existing.count += 1;
        } else {
          entityScores.set(r.entity_id, { score: r.effective_rating, count: 1 });
        }
      });

      const entityIds = [...entityScores.keys()];
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('id', entityIds);

      if (!entities) return [];

      const scoredEntities = entities
        .map(entity => {
          const agg = entityScores.get(entity.id) || { score: 0, count: 0 };
          return {
            ...entity,
            personalization_score: agg.count > 0 ? (agg.score / agg.count) * Math.log(agg.count + 1) : 0,
            reason: `${agg.count} similar items suggest this`
          };
        })
        .filter(e => (e.personalization_score || 0) > 0)
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
      const excludedIds = new Set(await getViewerReviewedEntityIds(userId));

      // Canonical endorsed reviews by similar users (canonical-first in SQL)
      const endorsed = (await getPublicEndorsements(similarUserIds))
        .filter(r => !excludedIds.has(r.entity_id));

      if (endorsed.length === 0) return [];

      const byEntity = new Map<string, { weighted: number; weight: number; lifestyleBoost: number }>();
      endorsed.forEach(r => {
        const userSimilarity = similarityMap.get(r.user_id);
        if (!userSimilarity) return;
        const weight = userSimilarity.overall_score;
        const lifestyleWeight = userSimilarity.lifestyle_score * 0.2;
        const total = weight + lifestyleWeight;
        if (total <= 0) return;
        const entry = byEntity.get(r.entity_id) || { weighted: 0, weight: 0, lifestyleBoost: 0 };
        entry.weighted += r.effective_rating * total;
        entry.weight += total;
        entry.lifestyleBoost = Math.max(entry.lifestyleBoost, userSimilarity.lifestyle_score);
        byEntity.set(r.entity_id, entry);
      });

      const entityIds = [...byEntity.keys()];
      if (entityIds.length === 0) return [];

      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('id', entityIds);

      if (!entities) return [];

      const mode = similarUsers[0]?.calculation_metadata?.effective_mode || 'SPARSE';

      const scoredEntities = entities.map(entity => {
        const agg = byEntity.get(entity.id) || { weighted: 0, weight: 0, lifestyleBoost: 0 };
        const averageWeightedRating = agg.weight > 0 ? agg.weighted / agg.weight : 0;

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
