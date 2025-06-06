
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { fetchSingleProfile, fetchMultipleProfiles, ProfileWithFallbacks } from '@/services/enhancedProfileService';

// Cache key factories
export const profileKeys = {
  all: ['profiles'] as const,
  single: (userId: string) => [...profileKeys.all, 'single', userId] as const,
  multiple: (userIds: string[]) => [...profileKeys.all, 'multiple', userIds.sort().join(',')] as const,
};

/**
 * Hook to fetch and cache a single profile
 */
export const useProfile = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: profileKeys.single(userId || ''),
    queryFn: () => fetchSingleProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch and cache multiple profiles efficiently
 */
export const useProfiles = (userIds: string[]) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: profileKeys.multiple(userIds),
    queryFn: async () => {
      // Check cache first for individual profiles
      const cachedProfiles: Record<string, ProfileWithFallbacks> = {};
      const uncachedUserIds: string[] = [];

      userIds.forEach(userId => {
        const cached = queryClient.getQueryData<ProfileWithFallbacks>(profileKeys.single(userId));
        if (cached) {
          cachedProfiles[userId] = cached;
        } else {
          uncachedUserIds.push(userId);
        }
      });

      // Fetch uncached profiles
      let newProfiles: Record<string, ProfileWithFallbacks> = {};
      if (uncachedUserIds.length > 0) {
        newProfiles = await fetchMultipleProfiles(uncachedUserIds);
        
        // Cache individual profiles
        Object.entries(newProfiles).forEach(([userId, profile]) => {
          queryClient.setQueryData(profileKeys.single(userId), profile);
        });
      }

      // Combine cached and new profiles
      return { ...cachedProfiles, ...newProfiles };
    },
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch profiles for a list of user IDs as an array
 */
export const useProfileList = (userIds: string[]) => {
  const { data: profileMap, ...rest } = useProfiles(userIds);
  
  const profileList = userIds.map(id => profileMap?.[id]).filter(Boolean) as ProfileWithFallbacks[];
  
  return {
    data: profileList,
    ...rest
  };
};

/**
 * Hook to invalidate profile cache when profile is updated
 */
export const useProfileCacheActions = () => {
  const queryClient = useQueryClient();

  const invalidateProfile = (userId: string) => {
    queryClient.invalidateQueries({ queryKey: profileKeys.single(userId) });
    queryClient.invalidateQueries({ queryKey: profileKeys.all });
  };

  const updateProfileCache = (userId: string, updatedProfile: ProfileWithFallbacks) => {
    queryClient.setQueryData(profileKeys.single(userId), updatedProfile);
  };

  return {
    invalidateProfile,
    updateProfileCache
  };
};
