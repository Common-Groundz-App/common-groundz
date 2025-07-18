
import { supabase } from '@/integrations/supabase/client';

export interface EntityRecommenderWithContext {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
  is_mutual: boolean;
  recommended_at: string;
  rating: number | null;
  title: string | null;
}

export async function getEntityRecommendersWithContext(
  entityId: string,
  currentUserId: string | null,
  options: {
    search?: string;
    relationshipFilter?: 'all' | 'following' | 'mutual';
    limit?: number;
    offset?: number;
  } = {}
): Promise<EntityRecommenderWithContext[]> {
  const {
    search,
    relationshipFilter = 'all',
    limit = 50,
    offset = 0
  } = options;

  let query = supabase
    .from('recommendations')
    .select(`
      user_id,
      created_at,
      rating,
      title,
      profiles!inner(
        id,
        username,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: recommendations, error } = await query;

  if (error) {
    console.error('Error fetching entity recommenders:', error);
    throw error;
  }

  if (!recommendations || recommendations.length === 0) {
    return [];
  }

  // Get follow relationships if user is logged in
  let followData: { follower_id: string; following_id: string }[] = [];
  if (currentUserId) {
    const userIds = recommendations.map(r => r.profiles.id);
    
    const { data: follows } = await supabase
      .from('follows')
      .select('follower_id, following_id')
      .or(`follower_id.eq.${currentUserId},following_id.eq.${currentUserId}`)
      .in('follower_id', [currentUserId, ...userIds])
      .in('following_id', [currentUserId, ...userIds]);
    
    followData = follows || [];
  }

  // Transform and add relationship context
  const recommenders: EntityRecommenderWithContext[] = recommendations.map(rec => {
    const profile = rec.profiles;
    const isFollowing = currentUserId ? followData.some(
      f => f.follower_id === currentUserId && f.following_id === profile.id
    ) : false;
    const isFollowedBy = currentUserId ? followData.some(
      f => f.follower_id === profile.id && f.following_id === currentUserId
    ) : false;
    const isMutual = isFollowing && isFollowedBy;

    return {
      id: profile.id,
      username: profile.username,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      is_following: isFollowing,
      is_mutual: isMutual,
      recommended_at: rec.created_at,
      rating: rec.rating,
      title: rec.title
    };
  });

  // Filter by search query
  let filteredRecommenders = recommenders;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredRecommenders = recommenders.filter(rec =>
      rec.username?.toLowerCase().includes(searchLower) ||
      rec.first_name?.toLowerCase().includes(searchLower) ||
      rec.last_name?.toLowerCase().includes(searchLower)
    );
  }

  // Filter by relationship
  if (relationshipFilter !== 'all') {
    filteredRecommenders = filteredRecommenders.filter(rec => {
      if (relationshipFilter === 'following') return rec.is_following;
      if (relationshipFilter === 'mutual') return rec.is_mutual;
      return true;
    });
  }

  // Sort: Circle users (people you follow) first, then by recommendation date
  filteredRecommenders.sort((a, b) => {
    // Prioritize circle users (people current user follows)
    if (a.is_following && !b.is_following) return -1;
    if (!a.is_following && b.is_following) return 1;
    
    // Then by mutual connections
    if (a.is_mutual && !b.is_mutual) return -1;
    if (!a.is_mutual && b.is_mutual) return 1;
    
    // Finally by recommendation date (most recent first)
    return new Date(b.recommended_at).getTime() - new Date(a.recommended_at).getTime();
  });

  return filteredRecommenders;
}
