import { supabase } from '@/integrations/supabase/client';

export interface RecommendedUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
  displayName?: string;
  initials?: string;
  isFollowing?: boolean;
}

export const getUserRecommendations = async (currentUserId?: string, limit: number = 5): Promise<RecommendedUser[]> => {
  if (!currentUserId) return [];

  try {
    // Get users that the current user is already following
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    const followingIds = followingData?.map(f => f.following_id) || [];

    // Build the query to exclude current user and already followed users
    let query = supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .neq('id', currentUserId)
      .not('username', 'is', null) // Only users with usernames
      .limit(limit * 2); // Get more to account for filtering

    // Exclude users already being followed
    if (followingIds.length > 0) {
      query = query.not('id', 'in', `(${followingIds.join(',')})`);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    // Transform the data and add display properties
    const recommendations: RecommendedUser[] = (users || [])
      .filter(user => user.username) // Additional filter for safety
      .slice(0, limit)
      .map(user => ({
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        displayName: user.username || 'Anonymous User',
        initials: getInitials(user.username),
        isFollowing: false
      }));

    return recommendations;
  } catch (error) {
    console.error('Error fetching user recommendations:', error);
    return [];
  }
};

const getInitials = (username: string | null): string => {
  if (!username) return 'AU';
  
  const parts = username.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
};