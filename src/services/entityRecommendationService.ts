
import { supabase } from '@/integrations/supabase/client';

export interface EntityRecommenderWithContext {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
  is_mutual: boolean;
  recommended_at: string;
  rating: number;
}

export const getEntityRecommendersWithContext = async (
  entityId: string,
  currentUserId: string | null,
  options: {
    search?: string;
    relationshipFilter?: 'all' | 'following' | 'mutual';
    limit?: number;
    offset?: number;
  } = {}
): Promise<EntityRecommenderWithContext[]> => {
  const { search, relationshipFilter = 'all', limit = 50, offset = 0 } = options;

  let query = supabase
    .from('recommendations')
    .select(`
      user_id,
      created_at,
      rating,
      profiles!inner(
        id,
        username,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('entity_id', entityId)
    .gte('rating', 4)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: recommendations, error } = await query;

  if (error) {
    console.error('Error fetching entity recommenders:', error);
    throw error;
  }

  if (!recommendations) return [];

  // Get follow relationships if user is authenticated
  let followingIds: string[] = [];
  let followersIds: string[] = [];

  if (currentUserId) {
    const userIds = recommendations.map(r => r.profiles.id);

    // Get who the current user follows
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .in('following_id', userIds);

    followingIds = following?.map(f => f.following_id) || [];

    // Get who follows the current user
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', currentUserId)
      .in('follower_id', userIds);

    followersIds = followers?.map(f => f.follower_id) || [];
  }

  // Transform and filter results
  const result = recommendations
    .map(rec => ({
      id: rec.profiles.id,
      username: rec.profiles.username,
      first_name: rec.profiles.first_name,
      last_name: rec.profiles.last_name,
      avatar_url: rec.profiles.avatar_url,
      is_following: followingIds.includes(rec.profiles.id),
      is_mutual: followingIds.includes(rec.profiles.id) && followersIds.includes(rec.profiles.id),
      recommended_at: rec.created_at,
      rating: rec.rating
    }))
    .filter(recommender => {
      // Search filter
      const searchMatch = !search || 
        recommender.username?.toLowerCase().includes(search.toLowerCase()) ||
        recommender.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        recommender.last_name?.toLowerCase().includes(search.toLowerCase());

      // Relationship filter
      const relationshipMatch = relationshipFilter === 'all' ||
        (relationshipFilter === 'following' && recommender.is_following) ||
        (relationshipFilter === 'mutual' && recommender.is_mutual);

      return searchMatch && relationshipMatch;
    })
    .sort((a, b) => {
      // Sort by relationship priority, then by recommendation date
      if (a.is_following !== b.is_following) {
        return a.is_following ? -1 : 1;
      }
      if (a.is_mutual !== b.is_mutual) {
        return a.is_mutual ? -1 : 1;
      }
      return new Date(b.recommended_at).getTime() - new Date(a.recommended_at).getTime();
    });

  return result;
};
