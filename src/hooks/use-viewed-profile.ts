
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFollowerCount, fetchFollowingCount } from '@/services/profileService';

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

  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
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

        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', viewingUserId)
          .single();

        if (error) throw error;

        // Fetch follower and following counts
        const followerCountData = await fetchFollowerCount(viewingUserId);
        const followingCountData = await fetchFollowingCount(viewingUserId);
        
        setFollowerCount(followerCountData);
        setFollowingCount(followingCountData);

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
          followerCount: followerCountData,
          followingCount: followingCountData,
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
          isOwnProfile: !profileUserId || (user && profileUserId === user?.id) || false
        }));
      }
    };

    if (user) {
      setProfile(prev => ({ ...prev, isLoading: true }));
      fetchProfileData();
    } else {
      setProfile(prev => ({ 
        ...prev, 
        isLoading: false,
        error: new Error('User not authenticated')
      }));
    }
  }, [profileUserId, user]);

  // Listen for follow status changes
  useEffect(() => {
    const handleFollowStatusChange = async (event: CustomEvent) => {
      if (!profileUserId) return;
      
      const { follower, following, action } = event.detail;
      
      if (profileUserId === following) {
        const updatedCount = action === 'follow' 
          ? profile.followerCount + 1 
          : Math.max(0, profile.followerCount - 1);
          
        setProfile(prev => ({
          ...prev,
          followerCount: updatedCount
        }));
      }
      
      if (profileUserId === follower) {
        const followingData = await fetchFollowingCount(profileUserId);
        
        setProfile(prev => ({
          ...prev,
          followingCount: followingData
        }));
      }
    };

    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    };
  }, [profileUserId, profile.followerCount]);

  return {
    ...profile
  };
};
