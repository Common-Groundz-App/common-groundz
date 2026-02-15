
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

export class SocialIntelligenceService {

  // Calculate and cache social influence scores
  async calculateSocialInfluenceScores(userId: string): Promise<void> {
    try {
      // Get all categories the user has recommendations in
      const { data: userCategories } = await supabase
        .from('recommendations')
        .select('category')
        .eq('user_id', userId);

      if (!userCategories) return;

      const uniqueCategories = [...new Set(userCategories.map(c => c.category))];

      // Calculate influence for each category
      for (const category of uniqueCategories) {
        const { data: influenceScore } = await supabase
          .rpc('calculate_social_influence_score', {
            p_user_id: userId,
            p_category: category
          });

        if (influenceScore !== null) {
          // Store the influence score
          await supabase
            .from('social_influence_scores')
            .upsert({
              user_id: userId,
              category: category,
              influence_score: influenceScore,
              last_calculated: new Date().toISOString()
            }, {
              onConflict: 'user_id,category'
            });
        }
      }
    } catch (error) {
      console.error('Error calculating social influence scores:', error);
    }
  }

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

      // Get influential users from the network
      const { data: influentialUsers } = await supabase
        .from('social_influence_scores')
        .select('user_id, category, influence_score')
        .in('user_id', followingIds)
        .gte('influence_score', 0.3) // Minimum influence threshold
        .order('influence_score', { ascending: false });

      if (!influentialUsers || influentialUsers.length === 0) {
        return [];
      }

      const influencerIds = influentialUsers.map(u => u.user_id);

      // Get user's already rated entities to exclude them
      const { data: userRatedEntities } = await supabase
        .from('recommendations')
        .select('entity_id')
        .eq('user_id', userId);

      const userRatedEntityIds = userRatedEntities?.map(r => r.entity_id) || [];

      // Get recommendations from influential users
      const { data: recommendations } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating, category, created_at)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', influencerIds)
        .gte('recommendations.rating', 4)
        .not('id', 'in', userRatedEntityIds.length > 0 ? `(${userRatedEntityIds.map(id => `'${id}'`).join(',')})` : '()')
        .order('recommendations.created_at', { ascending: false })
        .limit(limit * 2);

      if (!recommendations) return [];

      // Score recommendations based on influencer authority
      const scoredRecommendations: SocialRecommendation[] = recommendations.map(entity => {
        const recommendation = entity.recommendations?.[0];
        const influencer = influentialUsers.find(u => 
          u.user_id === recommendation?.user_id && 
          u.category === recommendation?.category
        );

        const influenceScore = influencer?.influence_score || 0;
        const socialProofScore = influenceScore * (recommendation?.rating || 0) / 5;

        return {
          ...entity,
          influencerIds: [recommendation?.user_id].filter(Boolean),
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

      // Get user's already rated entities to exclude them
      const { data: userRatedEntities } = await supabase
        .from('recommendations')
        .select('entity_id')
        .eq('user_id', userId);

      const userRatedEntityIds = userRatedEntities?.map(r => r.entity_id) || [];

      // Get recommendations from second-degree connections
      const { data: entities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', secondDegreeIds)
        .gte('recommendations.rating', 4.5) // Higher threshold for extended network
        .not('id', 'in', userRatedEntityIds.length > 0 ? `(${userRatedEntityIds.map(id => `'${id}'`).join(',')})` : '()')
        .limit(limit * 2);

      if (!entities) return [];

      // Score based on rating and network distance
      const scoredEntities: SocialRecommendation[] = entities.map(entity => {
        const recommendation = entity.recommendations?.[0];
        const rating = recommendation?.rating || 0;
        const networkScore = rating / 5 * 0.7; // Reduced weight for extended network

        return {
          ...entity,
          influencerIds: [recommendation?.user_id].filter(Boolean),
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

      // Get user's already rated entities to exclude them
      const { data: userRatedEntities } = await supabase
        .from('recommendations')
        .select('entity_id')
        .eq('user_id', userId);

      const userRatedEntityIds = userRatedEntities?.map(r => r.entity_id) || [];

      // Get recommendations from community
      const { data: entities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', communityMembers)
        .gte('recommendations.rating', 4)
        .not('id', 'in', userRatedEntityIds.length > 0 ? `(${userRatedEntityIds.map(id => `'${id}'`).join(',')})` : '()')
        .limit(limit * 2);

      if (!entities) return [];

      const scoredEntities: SocialRecommendation[] = entities.map(entity => {
        const recommendation = entity.recommendations?.[0];
        const rating = recommendation?.rating || 0;
        const communityScore = rating / 5 * 0.8;

        return {
          ...entity,
          influencerIds: [recommendation?.user_id].filter(Boolean),
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

  // Get cached influence scores
  async getInfluenceScores(userIds: string[]): Promise<SocialInfluenceScore[]> {
    try {
      const { data: scores } = await supabase
        .from('social_influence_scores')
        .select('*')
        .in('user_id', userIds)
        .gte('last_calculated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      return scores?.map(score => ({
        userId: score.user_id,
        category: score.category,
        influenceScore: score.influence_score,
        followerCount: score.follower_count,
        engagementRate: score.engagement_rate
      })) || [];
    } catch (error) {
      console.error('Error getting influence scores:', error);
      return [];
    }
  }
}

export const socialIntelligenceService = new SocialIntelligenceService();
