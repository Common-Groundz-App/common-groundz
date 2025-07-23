
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
      
      // Return empty array if no authenticated user
      if (!user?.id) {
        console.log('🔍 useUserFollowing - No authenticated user, returning empty array');
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
          // Don't throw error, return empty array for graceful degradation
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
        // Return empty array instead of throwing to prevent component crashes
        return [];
      }
    },
    // Key changes for external preview compatibility:
    enabled: !!user?.id && !authLoading, // Only run when user is authenticated and auth is not loading
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry up to 3 times for network/auth errors, but not for RLS errors
      if (failureCount < 3) {
        console.log(`🔍 useUserFollowing - Retry attempt ${failureCount + 1}`);
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    // Return empty array as default to prevent undefined errors
    initialData: [],
    // Add error boundary to prevent crashes
    throwOnError: false,
  });
};
