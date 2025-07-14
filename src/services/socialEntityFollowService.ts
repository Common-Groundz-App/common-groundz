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

    // Step 1: Get user IDs who follow this entity AND are in the user's following list
    const { data: entityFollowers, error: entityError } = await supabase
      .from('entity_follows')
      .select('user_id')
      .eq('entity_id', entityId)
      .in('user_id', followingIds);

    if (entityError) {
      console.error('Error fetching entity followers:', entityError);
      return [];
    }

    if (!entityFollowers || entityFollowers.length === 0) {
      console.log('No mutual followers found');
      return [];
    }

    const mutualUserIds = entityFollowers.map(ef => ef.user_id);
    console.log('Mutual user IDs:', mutualUserIds);

    // Step 2: Get profile data for the mutual followers
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, first_name, last_name')
      .in('id', mutualUserIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return [];
    }

    console.log('Profiles data:', profiles);

    return profiles?.map(profile => ({
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      first_name: profile.first_name,
      last_name: profile.last_name
    })) || [];
  } catch (error) {
    console.error('Error in getMutualEntityFollowersManual:', error);
    return [];
  }
};