
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFollowing } from '@/components/profile/circles/api/circleService';

export const useUserFollowing = () => {
  const { user, isLoading: authLoading } = useAuth();
  
  return useQuery({
    queryKey: ['user-following', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        const following = await fetchFollowing(user.id, user.id);
        return following.map(profile => profile.id);
      } catch (error) {
        console.error('Error fetching user following:', error);
        return [];
      }
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    // Return empty array as default
    initialData: [],
  });
};
