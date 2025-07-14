
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
  const startTime = Date.now();
  
  console.log('🔍 [MutualFollowers] Starting getMutualEntityFollowers', {
    entityId,
    currentUserId,
    timestamp: new Date().toISOString()
  });

  try {
    // Step 1: Get users that current user follows
    console.log('📝 [Step 1] Fetching users that current user follows...');
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    console.log('📊 [Step 1] Follows query result:', {
      data: followingData,
      error: followingError,
      dataLength: followingData?.length || 0,
      executionTime: `${Date.now() - startTime}ms`
    });

    if (followingError) {
      console.error('❌ [Step 1] Error fetching user follows:', followingError);
      return { mutualFollowers: [], count: 0 };
    }

    if (!followingData || followingData.length === 0) {
      console.log('⚠️ [Step 1] Current user follows no one, returning empty result');
      return { mutualFollowers: [], count: 0 };
    }

    const followingIds = followingData.map(f => f.following_id);
    console.log('✅ [Step 1] Following IDs extracted:', {
      followingIds,
      count: followingIds.length
    });

    // Step 2: Get mutual followers (users who follow both current user and the entity)
    console.log('📝 [Step 2] Fetching entity followers that current user also follows...');
    const { data: mutualFollowerIds, error: mutualError } = await supabase
      .from('entity_follows')
      .select('user_id')
      .eq('entity_id', entityId)
      .in('user_id', followingIds);

    console.log('📊 [Step 2] Entity follows query result:', {
      data: mutualFollowerIds,
      error: mutualError,
      dataLength: mutualFollowerIds?.length || 0,
      entityId,
      followingIdsUsed: followingIds,
      executionTime: `${Date.now() - startTime}ms`
    });

    if (mutualError) {
      console.error('❌ [Step 2] Error fetching mutual entity followers:', mutualError);
      return { mutualFollowers: [], count: 0 };
    }

    if (!mutualFollowerIds || mutualFollowerIds.length === 0) {
      console.log('⚠️ [Step 2] No mutual followers found - entity has no followers from current user\'s following list');
      return { mutualFollowers: [], count: 0 };
    }

    const mutualUserIds = mutualFollowerIds.map(mf => mf.user_id);
    console.log('✅ [Step 2] Mutual user IDs extracted:', {
      mutualUserIds,
      count: mutualUserIds.length
    });

    // Step 3: Get profile data for mutual followers
    console.log('📝 [Step 3] Fetching profile data for mutual followers...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, first_name, last_name, bio, location')
      .in('id', mutualUserIds);

    console.log('📊 [Step 3] Profiles query result:', {
      data: profilesData,
      error: profilesError,
      dataLength: profilesData?.length || 0,
      mutualUserIdsUsed: mutualUserIds,
      executionTime: `${Date.now() - startTime}ms`
    });

    if (profilesError) {
      console.error('❌ [Step 3] Error fetching mutual follower profiles:', profilesError);
      return { mutualFollowers: [], count: 0 };
    }

    console.log('🔄 [Step 3] Transforming profiles to safe format...');
    const safeProfiles = (profilesData || []).map(profile => {
      const transformed = transformToSafeProfile(profile);
      console.log('🔄 Profile transformation:', { original: profile, transformed });
      return transformed;
    });

    const finalResult = {
      mutualFollowers: safeProfiles,
      count: safeProfiles.length
    };

    console.log('🎉 [MutualFollowers] Final result:', {
      ...finalResult,
      totalExecutionTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    return finalResult;

  } catch (error) {
    console.error('💥 [MutualFollowers] Unexpected error in getMutualEntityFollowers:', {
      error,
      entityId,
      currentUserId,
      executionTime: `${Date.now() - startTime}ms`
    });
    return { mutualFollowers: [], count: 0 };
  }
};
