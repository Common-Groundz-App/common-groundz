
import { supabase } from '@/integrations/supabase/client';
import { PersonalizedEntity } from './enhancedExploreService';

export interface SocialInfluenceScore {
  userId: string;
  category: string;
  influenceScore: number;
  followerCount: number;
  engagementRate: number;
}

export interface SocialRecommendation extends PersonalizedEntity {
  influencerIds: string[];
  socialProofScore: number;
  friendsWhoLiked: number;
}

/**
 * Phase 4.2B.3 — social pipeline contract:
 *
 * - social_influence_scores_v2 is READ-ONLY from the browser. Only the scheduled
 *   service-role refresh writes influence rows; there is intentionally no caller
 *   for that refresh here.
 * - Influencer rule: followed users with influence_score > 0, ranked DESC, top N.
 * - Recommendation sourcing goes through get_canonical_endorsements_for_viewer:
 *   canonical selection (one current review per person per item) happens in SQL
 *   BEFORE the endorsement flag is inspected; visibility is public + circle_only
 *   reviews by authors the viewer follows (+ the viewer's own), enforced
 *   server-side with identity verification.
 * - The viewer never appears in a social-proof author set: the viewer's own
 *   endorsement is excluded from influencer/extended/community candidates even
 *   though the viewer-scoped routine can technically return it.
 * - Effective rating is used only for scoring/ordering.
 * - The viewer's exclusion set is ALL of the viewer's own reviews (any status or
 *   visibility, including drafts).
 */

/** Row returned by get_canonical_endorsements_for_viewer — already canonical + endorsed. */
interface EndorsementRow {
  user_id: string;
  entity_id: string;
  effective_rating: number;
  created_at: string;
}

/** All entity ids the viewer has any review record for (any status/visibility, incl. drafts). */
const getViewerReviewedEntityIds = async (userId: string): Promise<string[]> => {
  const { data } = await supabase
    .from('reviews')
    .select('entity_id')
    .eq('user_id', userId)
    .not('entity_id', 'is', null);
  return [...new Set((data || []).map(r => r.entity_id as string))];
};

/**
 * Viewer-visible canonical endorsements by the given authors (canonical-first in SQL).
 * The viewer is always removed from the author set: social proof must come from
 * other people, never from the viewer's own endorsement.
 */
const getViewerVisibleEndorsements = async (
  viewerId: string,
  userIds: string[]
): Promise<EndorsementRow[]> => {
  const authorIds = userIds.filter(id => id !== viewerId);
  if (authorIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_canonical_endorsements_for_viewer', {
    p_viewer_id: viewerId,
    p_user_ids: authorIds
  });
  if (error) {
    console.error('Error fetching viewer-visible endorsements:', error);
    return [];
  }
  return (data || []) as EndorsementRow[];
};

const fetchEntitiesByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('entities')
    .select('*')
    .eq('is_deleted', false)
    .in('id', ids);
  return data || [];
};

export class SocialIntelligenceService {

  // Get recommendations from influential users in social network
  async getInfluencerRecommendations(
    userId: string, 
    limit: number = 6
  ): Promise<SocialRecommendation[]> {
    try {
      // Get users that current user follows
      const { data: followingUsers } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (!followingUsers || followingUsers.length === 0) {
        return [];
      }

      const followingIds = followingUsers.map(f => f.following_id);

      // Influencer rule: followed users with influence_score > 0, ranked DESC, top 20
      const { data: influentialUsers } = await supabase
        .from('social_influence_scores_v2')
        .select('user_id, canonical_type, influence_score')
        .in('user_id', followingIds)
        .gt('influence_score', 0)
        .order('influence_score', { ascending: false })
        .limit(20);

      if (!influentialUsers || influentialUsers.length === 0) {
        return [];
      }

      const influencerIds = [...new Set(influentialUsers.map(u => u.user_id))];
      const maxInfluenceByUser = new Map<string, number>();
      influentialUsers.forEach(u => {
        const current = maxInfluenceByUser.get(u.user_id) || 0;
        if (u.influence_score > current) maxInfluenceByUser.set(u.user_id, u.influence_score);
      });

      const excludedIds = new Set(await getViewerReviewedEntityIds(userId));

      // Canonical endorsed reviews by influential users (viewer-authorized, canonical-first)
      const endorsed = (await getViewerVisibleEndorsements(userId, influencerIds))
        .filter(r => !excludedIds.has(r.entity_id))
        .slice(0, limit * 2);

      if (endorsed.length === 0) return [];

      const entities = await fetchEntitiesByIds([...new Set(endorsed.map(r => r.entity_id))]);

      // Score recommendations based on influencer authority
      const scoredRecommendations: SocialRecommendation[] = entities.map(entity => {
        const recommendation = endorsed.find(r => r.entity_id === entity.id);
        const influenceScore = maxInfluenceByUser.get(recommendation?.user_id || '') || 0;
        const socialProofScore = influenceScore * (recommendation?.effective_rating ?? 0) / 5;

        return {
          ...entity,
          influencerIds: [recommendation?.user_id].filter(Boolean) as string[],
          socialProofScore,
          friendsWhoLiked: 1,
          personalization_score: socialProofScore * 20, // Scale for comparison
          reason: `Recommended by influential user (${(influenceScore * 100).toFixed(0)}% influence)`
        };
      });

      return scoredRecommendations
        .sort((a, b) => b.socialProofScore - a.socialProofScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting influencer recommendations:', error);
      return [];
    }
  }

  // Get multi-degree social recommendations (friends of friends)
  async getExtendedSocialRecommendations(
    userId: string, 
    limit: number = 6
  ): Promise<SocialRecommendation[]> {
    try {
      // Get first-degree connections (direct follows)
      const { data: firstDegreeUsers } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (!firstDegreeUsers || firstDegreeUsers.length === 0) {
        return [];
      }

      const firstDegreeIds = firstDegreeUsers.map(u => u.following_id);

      // Get second-degree connections (friends of friends)
      const { data: secondDegreeUsers } = await supabase
        .from('follows')
        .select('following_id')
        .in('follower_id', firstDegreeIds)
        .neq('following_id', userId); // Exclude self

      if (!secondDegreeUsers || secondDegreeUsers.length === 0) {
        return [];
      }

      const secondDegreeIds = [...new Set(secondDegreeUsers.map(u => u.following_id))];
      const excludedIds = new Set(await getViewerReviewedEntityIds(userId));

      // Canonical endorsed reviews from second-degree connections (viewer-authorized)
      const endorsed = (await getViewerVisibleEndorsements(userId, secondDegreeIds))
        .filter(r => !excludedIds.has(r.entity_id))
        .slice(0, limit * 2);

      if (endorsed.length === 0) return [];

      const entities = await fetchEntitiesByIds([...new Set(endorsed.map(r => r.entity_id))]);

      // Score based on effective rating and network distance
      const scoredEntities: SocialRecommendation[] = entities.map(entity => {
        const recommendation = endorsed.find(r => r.entity_id === entity.id);
        const rating = recommendation?.effective_rating ?? 0;
        const networkScore = rating / 5 * 0.7; // Reduced weight for extended network

        return {
          ...entity,
          influencerIds: [recommendation?.user_id].filter(Boolean) as string[],
          socialProofScore: networkScore,
          friendsWhoLiked: 1,
          personalization_score: networkScore * 15,
          reason: 'Popular in your extended network'
        };
      });

      return scoredEntities
        .sort((a, b) => b.socialProofScore - a.socialProofScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting extended social recommendations:', error);
      return [];
    }
  }

  // Get community-based recommendations
  async getCommunityRecommendations(
    userId: string, 
    limit: number = 6
  ): Promise<SocialRecommendation[]> {
    try {
      // Find users with similar follow patterns (community detection)
      const { data: userFollows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (!userFollows || userFollows.length === 0) {
        return [];
      }

      const userFollowingIds = userFollows.map(f => f.following_id);

      // Find other users who follow similar people
      const { data: similarUsers } = await supabase
        .from('follows')
        .select('follower_id')
        .in('following_id', userFollowingIds)
        .neq('follower_id', userId);

      if (!similarUsers) return [];

      // Count overlap and find community members
      const userOverlap = new Map<string, number>();
      similarUsers.forEach(follow => {
        const current = userOverlap.get(follow.follower_id) || 0;
        userOverlap.set(follow.follower_id, current + 1);
      });

      // Get users with significant overlap (community members)
      const communityMembers = Array.from(userOverlap.entries())
        .filter(([_, overlap]) => overlap >= Math.min(3, userFollowingIds.length * 0.3))
        .map(([userId, _]) => userId)
        .slice(0, 20);

      if (communityMembers.length === 0) return [];

      const excludedIds = new Set(await getViewerReviewedEntityIds(userId));

      // Canonical endorsed reviews from the community (viewer-authorized)
      const endorsed = (await getViewerVisibleEndorsements(userId, communityMembers))
        .filter(r => !excludedIds.has(r.entity_id))
        .slice(0, limit * 2);

      if (endorsed.length === 0) return [];

      const entities = await fetchEntitiesByIds([...new Set(endorsed.map(r => r.entity_id))]);

      const scoredEntities: SocialRecommendation[] = entities.map(entity => {
        const recommendation = endorsed.find(r => r.entity_id === entity.id);
        const rating = recommendation?.effective_rating ?? 0;
        const communityScore = rating / 5 * 0.8;

        return {
          ...entity,
          influencerIds: [recommendation?.user_id].filter(Boolean) as string[],
          socialProofScore: communityScore,
          friendsWhoLiked: 1,
          personalization_score: communityScore * 18,
          reason: 'Popular in your community'
        };
      });

      return scoredEntities
        .sort((a, b) => b.socialProofScore - a.socialProofScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting community recommendations:', error);
      return [];
    }
  }

  // Get cached influence scores (v2 read-only table)
  async getInfluenceScores(userIds: string[]): Promise<SocialInfluenceScore[]> {
    try {
      const { data: scores } = await supabase
        .from('social_influence_scores_v2')
        .select('*')
        .in('user_id', userIds)
        .gte('last_calculated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      return scores?.map(score => ({
        userId: score.user_id,
        category: score.canonical_type,
        influenceScore: score.influence_score,
        followerCount: score.follower_count,
        engagementRate: score.engagement_avg
      })) || [];
    } catch (error) {
      console.error('Error getting influence scores:', error);
      return [];
    }
  }
}

export const socialIntelligenceService = new SocialIntelligenceService();
