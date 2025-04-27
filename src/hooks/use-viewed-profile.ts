
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileFollows } from './profile/use-profile-follows';

interface ViewedProfile {
  username: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  createdAt: string;
  displayName: string;
  followerCount: number;
  followingCount: number;
  isLoading: boolean;
  error: Error | null;
  isOwnProfile: boolean;
}

export const useViewedProfile = (profileUserId?: string) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ViewedProfile>({
    username: '',
    bio: '',
    location: '',
    avatarUrl: '',
    createdAt: '',
    displayName: '',
    followerCount: 0,
    followingCount: 0,
    isLoading: true,
    error: null,
    isOwnProfile: false
  });

  const {
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount
  } = useProfileFollows(profileUserId);

  useEffect(() => {
    const fetchProfileData = async () => {
      // If no profileUserId is provided, use the current user's ID
      const viewingUserId = profileUserId || (user?.id || '');
      const isOwnProfile = !profileUserId || (user && profileUserId === user.id);
      
      if (!viewingUserId) {
        setProfile(prev => ({
          ...prev,
          isLoading: false,
          error: new Error('User ID is missing'),
          isOwnProfile: false
        }));
        return;
      }

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', viewingUserId)
          .single();

        if (error) throw error;

        // If viewing own profile, use auth metadata for name
        let displayName = profileData?.username || 'User';

        if (isOwnProfile && user?.user_metadata) {
          const { first_name, last_name } = user.user_metadata;
          if (first_name || last_name) {
            displayName = `${first_name || ''} ${last_name || ''}`.trim();
          }
        }

        setProfile({
          username: profileData?.username || null,
          bio: profileData?.bio || null,
          location: profileData?.location || null,
          avatarUrl: profileData?.avatar_url || null,
          createdAt: profileData?.created_at || new Date().toISOString(),
          displayName,
          followerCount,
          followingCount,
          isLoading: false,
          error: null,
          isOwnProfile
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        setProfile(prev => ({
          ...prev,
          isLoading: false,
          error: error as Error,
          isOwnProfile
        }));
      }
    };

    setProfile(prev => ({ ...prev, isLoading: true }));
    fetchProfileData();
  }, [profileUserId, user, followerCount, followingCount]);

  return {
    ...profile
  };
};
