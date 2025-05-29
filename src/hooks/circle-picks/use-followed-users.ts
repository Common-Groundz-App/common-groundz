
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FollowedUser } from '@/types/circle-picks';

export const useFollowedUsers = () => {
  const { user } = useAuth();
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowedUsers = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get the list of users that the current user follows
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('following_id, created_at')
          .eq('follower_id', user.id);

        if (followsError) throw followsError;

        if (!followsData || followsData.length === 0) {
          setFollowedUsers([]);
          setLoading(false);
          return;
        }

        // Get profile information for followed users
        const followedUserIds = followsData.map(follow => follow.following_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', followedUserIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const followedUsersWithProfiles: FollowedUser[] = followsData
          .map(follow => {
            const profile = profilesData?.find(p => p.id === follow.following_id);
            if (!profile) return null;

            return {
              id: profile.id,
              username: profile.username || 'Unknown User',
              fullName: profile.username || 'Unknown User', // We'll use username as display name for now
              avatarUrl: profile.avatar_url,
              followedAt: follow.created_at
            };
          })
          .filter((user): user is FollowedUser => user !== null);

        setFollowedUsers(followedUsersWithProfiles);
      } catch (err) {
        console.error('Error fetching followed users:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch followed users');
      } finally {
        setLoading(false);
      }
    };

    fetchFollowedUsers();
  }, [user]);

  return {
    followedUsers,
    loading,
    error,
    refetch: () => {
      if (user) {
        setLoading(true);
        setError(null);
      }
    }
  };
};
