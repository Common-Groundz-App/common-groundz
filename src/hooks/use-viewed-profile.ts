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

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const viewingUserId = profileUserId || user?.id;
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

        const [followerCountData, followingCountData] = await Promise.all([
          fetchFollowerCount(viewingUserId),
          fetchFollowingCount(viewingUserId)
        ]);
        
        console.log(`Fetched counts for ${viewingUserId}: followers=${followerCountData}, following=${followingCountData}`);

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

  useEffect(() => {
    const handleFollowStatusChange = async (event: CustomEvent) => {
      if (!profileUserId) return;
      
      const { follower, following, action } = event.detail;
      
      if (profileUserId === following) {
        const updatedCount = action === 'follow' 
          ? profile.followerCount + 1 
          : Math.max(0, profile.followerCount - 1);
          
        console.log(`Follow status change: ${action} - updating follower count to ${updatedCount}`);
        
        setProfile(prev => ({
          ...prev,
          followerCount: updatedCount
        }));
      }
      
      if (profileUserId === follower) {
        const followingCount = await fetchFollowingCount(profileUserId);
        
        console.log(`Profile following someone: updating following count to ${followingCount}`);
        
        setProfile(prev => ({
          ...prev,
          followingCount: followingCount
        }));
      }
    };

    const handleFollowerCountChanged = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.count === 'number') {
        console.log(`Follower count explicitly updated to: ${event.detail.count}`);
        setProfile(prev => ({
          ...prev,
          followerCount: event.detail.count
        }));
      } else if (event.detail && typeof event.detail.countChange === 'number') {
        const newCount = profile.followerCount + event.detail.countChange;
        console.log(`Follower count changed by ${event.detail.countChange} to: ${newCount}`);
        setProfile(prev => ({
          ...prev,
          followerCount: Math.max(0, newCount)
        }));
      }
    };

    const handleFollowingCountChanged = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.count === 'number') {
        console.log(`Following count explicitly updated to: ${event.detail.count}`);
        setProfile(prev => ({
          ...prev,
          followingCount: event.detail.count
        }));
      } else if (event.detail && typeof event.detail.countChange === 'number') {
        const newCount = profile.followingCount + event.detail.countChange;
        console.log(`Following count changed by ${event.detail.countChange} to: ${newCount}`);
        setProfile(prev => ({
          ...prev,
          followingCount: Math.max(0, newCount)
        }));
      }
    };

    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    window.addEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
    window.addEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
    
    return () => {
      window.removeEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
      window.removeEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
      window.removeEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
    };
  }, [profileUserId, profile.followerCount, profile.followingCount]);

  return {
    ...profile
  };
};
