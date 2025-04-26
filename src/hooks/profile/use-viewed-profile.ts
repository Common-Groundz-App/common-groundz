
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProfileFollows } from './use-profile-follows';

interface ViewedProfile {
  id: string;
  username: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
  isOwnProfile: boolean;
  displayName: string;
  followerCount: number;
  followingCount: number;
}

export const useViewedProfile = (profileId?: string) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ViewedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isOwnProfile = !profileId || (user && profileId === user.id);

  const {
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount
  } = useProfileFollows(profileId || user?.id);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const targetUserId = profileId || user?.id;
        if (!targetUserId) {
          throw new Error('No user ID available');
        }

        // Fetch profile data from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single();

        if (profileError) throw profileError;

        if (!profileData) {
          throw new Error('Profile not found');
        }

        // For own profile, we can use auth metadata
        let displayName = profileData.username || 'User';
        if (isOwnProfile && user?.user_metadata) {
          const { first_name, last_name } = user.user_metadata;
          if (first_name || last_name) {
            displayName = `${first_name || ''} ${last_name || ''}`.trim();
          }
        }

        setProfile({
          ...profileData,
          isOwnProfile,
          displayName,
          followerCount,
          followingCount
        });

      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user, profileId, followerCount, followingCount, isOwnProfile]);

  return {
    profile,
    isLoading,
    error,
    isOwnProfile,
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount
  };
};
