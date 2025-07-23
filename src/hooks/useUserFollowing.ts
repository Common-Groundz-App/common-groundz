
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserFollowing {
  following_id: string;
}

export const useUserFollowing = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowingIds = async () => {
      // Don't fetch if auth is still loading
      if (authLoading) {
        return;
      }

      // If no user, clear following and return
      if (!user?.id) {
        setFollowingIds([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (error) throw error;

        const ids = data?.map(follow => follow.following_id) || [];
        setFollowingIds(ids);
        console.log(`Fetched ${ids.length} following relationships for user ${user.id}`);
      } catch (err: any) {
        console.error('Error fetching user following:', err);
        setError(err.message);
        setFollowingIds([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowingIds();
  }, [user?.id, authLoading]);

  return {
    followingIds,
    isLoading,
    error,
    hasFollowing: followingIds.length > 0
  };
};
