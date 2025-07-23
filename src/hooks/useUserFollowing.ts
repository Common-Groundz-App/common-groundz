
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useUserFollowing = () => {
  const { user, isLoading: authLoading } = useAuth();
  
  return useQuery({
    queryKey: ['user-following', user?.id],
    queryFn: async () => {
      console.log('🔍 useUserFollowing - Starting query for user:', user?.id);
      console.log('🔍 Auth state:', { 
        hasUser: !!user, 
        userId: user?.id, 
        authLoading,
        userEmail: user?.email 
      });
      
      if (!user?.id) {
        console.log('🔍 useUserFollowing - No user ID, returning empty array');
        return [];
      }
      
      try {
        // Always use direct query approach since it's more reliable
        console.log('🔍 useUserFollowing - Using direct query to follows table');
        
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        if (followsError) {
          console.error('🔍 useUserFollowing - Direct query failed:', followsError);
          return [];
        }
        
        const followingIds = followsData?.map(follow => follow.following_id) || [];
        console.log('🔍 useUserFollowing - Direct query success:', {
          followsDataLength: followsData?.length || 0,
          followingIds,
          rawFollowsData: followsData
        });
        
        return followingIds;
      } catch (error) {
        console.error('🔍 useUserFollowing - Unexpected error:', error);
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
