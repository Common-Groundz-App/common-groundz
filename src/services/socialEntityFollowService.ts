import { supabase } from '@/integrations/supabase/client';

export interface MutualFollower {
  id: string;
  username: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
}


// Manual implementation as the main function
export const getMutualEntityFollowersManual = async (
  entityId: string, 
  currentUserId: string
): Promise<MutualFollower[]> => {
  try {
    // First get users that current user follows
    const { data: userFollows, error: followsError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (followsError || !userFollows) return [];

    const followingIds = userFollows.map(f => f.following_id);
    if (followingIds.length === 0) return [];

    // Then get users from that list who also follow this entity
    const { data: mutualFollowers, error: mutualError } = await supabase
      .from('entity_follows')
      .select(`
        user_id,
        profiles!inner (
          id,
          username,
          avatar_url,
          first_name,
          last_name
        )
      `)
      .eq('entity_id', entityId)
      .in('user_id', followingIds);

    if (mutualError) {
      console.error('Error fetching mutual entity followers:', mutualError);
      return [];
    }

    console.log('Raw mutual followers data:', mutualFollowers);

    // The profiles data is directly accessible, not nested under mf.profiles
    return mutualFollowers?.map(mf => ({
      id: mf.profiles.id,
      username: mf.profiles.username,
      avatar_url: mf.profiles.avatar_url,
      first_name: mf.profiles.first_name,
      last_name: mf.profiles.last_name
    })).filter(Boolean) || [];
  } catch (error) {
    console.error('Error in getMutualEntityFollowersManual:', error);
    return [];
  }
};