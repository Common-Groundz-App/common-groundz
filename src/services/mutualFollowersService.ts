
import { supabase } from '@/integrations/supabase/client';
import { transformToSafeProfile, SafeUserProfile } from '@/types/profile';

export interface MutualFollowersResult {
  mutualFollowers: SafeUserProfile[];
  count: number;
}

export const getMutualEntityFollowers = async (
  entityId: string,
  currentUserId: string
): Promise<MutualFollowersResult> => {
  try {
    // Step 1: Get users that current user follows
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (followingError) {
      console.error('Error fetching user follows:', followingError);
      return { mutualFollowers: [], count: 0 };
    }

    if (!followingData || followingData.length === 0) {
      return { mutualFollowers: [], count: 0 };
    }

    const followingIds = followingData.map(f => f.following_id);

    // Step 2: Get mutual followers (users who follow both current user and the entity)
    const { data: mutualFollowerIds, error: mutualError } = await supabase
      .from('entity_follows')
      .select('user_id')
      .eq('entity_id', entityId)
      .in('user_id', followingIds);

    if (mutualError) {
      console.error('Error fetching mutual entity followers:', mutualError);
      return { mutualFollowers: [], count: 0 };
    }

    if (!mutualFollowerIds || mutualFollowerIds.length === 0) {
      return { mutualFollowers: [], count: 0 };
    }

    const mutualUserIds = mutualFollowerIds.map(mf => mf.user_id);

    // Step 3: Get profile data for mutual followers
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, first_name, last_name, bio, location')
      .in('id', mutualUserIds);

    if (profilesError) {
      console.error('Error fetching mutual follower profiles:', profilesError);
      return { mutualFollowers: [], count: 0 };
    }

    const safeProfiles = (profilesData || []).map(profile => 
      transformToSafeProfile(profile)
    );

    return {
      mutualFollowers: safeProfiles,
      count: safeProfiles.length
    };

  } catch (error) {
    console.error('Error in getMutualEntityFollowers:', error);
    return { mutualFollowers: [], count: 0 };
  }
};
