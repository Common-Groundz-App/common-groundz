
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useUserFollowing = () => {
  const { user, isLoading: authLoading } = useAuth();
  
  return useQuery({
    queryKey: ['user-following', user?.id],
    queryFn: async () => {
      console.log('useUserFollowing - Starting query for user:', user?.id);
      
      if (!user?.id) {
        console.log('useUserFollowing - No user ID, returning empty array');
        return [];
      }
      
      try {
        // Try the RPC function first
        console.log('useUserFollowing - Attempting RPC call: get_following_with_profiles');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_following_with_profiles', {
            profile_user_id: user.id,
            current_user_id: user.id
          });
        
        if (!rpcError && rpcData && Array.isArray(rpcData)) {
          console.log('useUserFollowing - RPC success, got', rpcData.length, 'following users');
          const followingIds = rpcData.map(profile => profile.id);
          console.log('useUserFollowing - RPC following IDs:', followingIds);
          return followingIds;
        }
        
        console.log('useUserFollowing - RPC failed with error:', rpcError);
        console.log('useUserFollowing - Falling back to direct query');
        
        // Fallback: Direct query to follows table
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        if (followsError) {
          console.error('useUserFollowing - Fallback query failed:', followsError);
          return [];
        }
        
        const followingIds = followsData?.map(follow => follow.following_id) || [];
        console.log('useUserFollowing - Fallback success, got', followingIds.length, 'following IDs:', followingIds);
        
        return followingIds;
      } catch (error) {
        console.error('useUserFollowing - Unexpected error:', error);
        return [];
      }
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
    // Return empty array as default
    initialData: [],
  });
};
