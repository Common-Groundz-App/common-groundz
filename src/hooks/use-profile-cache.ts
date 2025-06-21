
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSingleProfile, fetchProfilesBatch } from '@/services/unifiedProfileService';
import { SafeUserProfile } from '@/types/profile';

/**
 * Hook for fetching a single user profile with caching
 */
export const useProfile = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchSingleProfile(userId || ''),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching multiple user profiles with caching
 */
export const useProfiles = (userIds: string[]) => {
  return useQuery({
    queryKey: ['profiles', userIds.sort().join(',')],
    queryFn: () => fetchProfilesBatch(userIds),
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    select: (data) => data.profiles,
  });
};

/**
 * Hook that provides a profile fetcher function for dynamic usage
 */
export const useProfileFetcher = () => {
  return {
    fetchProfile: fetchSingleProfile,
    fetchProfiles: fetchProfilesBatch,
  };
};

/**
 * Hook for cache actions
 */
export const useProfileCacheActions = () => {
  const queryClient = useQueryClient();

  return {
    invalidateProfile: (userId: string) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    updateProfileCache: (userId: string, profile: SafeUserProfile) => {
      queryClient.setQueryData(['profile', userId], profile);
    },
  };
};
