
import { useState, useCallback } from 'react';
import { fetchFollowerCount, fetchFollowingCount } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

export const useProfileFollows = (userId?: string) => {
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const { toast } = useToast();

  const refreshCounts = useCallback(async () => {
    if (!userId) return;

    try {
      const [newFollowerCount, newFollowingCount] = await Promise.all([
        fetchFollowerCount(userId),
        fetchFollowingCount(userId)
      ]);
      
      setFollowerCount(newFollowerCount);
      setFollowingCount(newFollowingCount);
    } catch (error) {
      console.error('Error refreshing follow counts:', error);
      toast({
        title: 'Error',
        description: 'Failed to update follow counts',
        variant: 'destructive',
      });
    }
  }, [userId]);

  return {
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount,
    refreshCounts
  };
};
