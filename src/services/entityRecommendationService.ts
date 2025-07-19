
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
  latest_rating: number | null;
  effective_rating: number;
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

  // Step 1: Get reviews for this entity that are recommendations (is_recommended = true)
  let reviewsQuery = supabase
    .from('reviews')
    .select('user_id, created_at, rating, latest_rating')
    .eq('entity_id', entityId)
    .eq('is_recommended', true)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (limit) {
    reviewsQuery = reviewsQuery.limit(limit + offset); // Get more to account for filtering
  }

  const { data: reviews, error: reviewError } = await reviewsQuery;

  if (reviewError) {
    console.error('Error fetching reviews:', reviewError);
    throw reviewError;
  }

  if (!reviews || reviews.length === 0) return [];

  // Step 2: Get user profiles for all recommenders
  const userIds = reviews.map(review => review.user_id);
  
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name, avatar_url')
    .in('id', userIds);

  if (profileError) {
    console.error('Error fetching profiles:', profileError);
    throw profileError;
  }

  if (!profiles) return [];

  // Step 3: Get follow relationships if user is authenticated
  let followingIds: string[] = [];
  let followersIds: string[] = [];

  if (currentUserId) {
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

  // Step 4: Combine data and create result objects
  const result = reviews
    .map(review => {
      const profile = profiles.find(p => p.id === review.user_id);
      if (!profile) return null;

      const effective_rating = review.latest_rating || review.rating;
      
      return {
        id: profile.id,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        is_following: followingIds.includes(profile.id),
        is_mutual: followingIds.includes(profile.id) && followersIds.includes(profile.id),
        recommended_at: review.created_at,
        rating: review.rating,
        latest_rating: review.latest_rating,
        effective_rating
      };
    })
    .filter((item): item is EntityRecommenderWithContext => item !== null)
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

  // Apply pagination after filtering and sorting
  return result.slice(offset, offset + limit);
};
