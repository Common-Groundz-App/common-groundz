import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useProfileCacheActions } from '@/hooks/use-profile-cache';
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
  const viewingUserId = profileUserId || user?.id;
  const isOwnProfile = !profileUserId || (user && profileUserId === user.id);
  
  // Use enhanced profile service
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(viewingUserId);
  const { invalidateProfile } = useProfileCacheActions();
  
  const [profile_state, setProfile] = useState<ViewedProfile>({
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
    isOwnProfile
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        if (!viewingUserId) {
          setProfile(prev => ({
            ...prev,
            isLoading: false,
            error: new Error('User ID is missing'),
            isOwnProfile: false
          }));
          return;
        }

        if (profile) {
          const [followerCountData, followingCountData] = await Promise.all([
            fetchFollowerCount(viewingUserId),
            fetchFollowingCount(viewingUserId)
          ]);
          
          console.log(`Fetched counts for ${viewingUserId}: followers=${followerCountData}, following=${followingCountData}`);

          setProfile({
            username: profile.username,
            bio: profile.bio,
            location: profile.location,
            avatarUrl: profile.avatar_url,
            createdAt: profile.created_at || new Date().toISOString(),
            displayName: profile.displayName,
            followerCount: followerCountData,
            followingCount: followingCountData,
            isLoading: false,
            error: null,
            isOwnProfile
          });
        }
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

    if (user) {
      setProfile(prev => ({ ...prev, isLoading: profileLoading }));
      if (!profileLoading && profile) {
        fetchProfileData();
      } else if (profileError) {
        setProfile(prev => ({ 
          ...prev, 
          isLoading: false,
          error: profileError as Error
        }));
      }
    } else {
      setProfile(prev => ({ 
        ...prev, 
        isLoading: false,
        error: new Error('User not authenticated')
      }));
    }
  }, [profileUserId, user, profile, profileLoading, profileError, viewingUserId, isOwnProfile]);

  // Listen for profile-updated events to invalidate cache
  useEffect(() => {
    const handleProfileUpdated = (event: CustomEvent) => {
      const eventUserId = event.detail?.userId;
      // Only invalidate if this is the profile we're viewing
      if (viewingUserId && (!eventUserId || eventUserId === viewingUserId)) {
        invalidateProfile(viewingUserId);
      }
    };
    
    window.addEventListener('profile-updated', handleProfileUpdated as EventListener);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated as EventListener);
  }, [viewingUserId, invalidateProfile]);

  useEffect(() => {
    const handleFollowStatusChange = async (event: CustomEvent) => {
      if (!profileUserId) return;
      
      const { follower, following, action } = event.detail;
      
      if (profileUserId === following) {
        const updatedCount = action === 'follow' 
          ? profile_state.followerCount + 1 
          : Math.max(0, profile_state.followerCount - 1);
          
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
        const newCount = profile_state.followerCount + event.detail.countChange;
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
        const newCount = profile_state.followingCount + event.detail.countChange;
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
  }, [profileUserId, profile_state.followerCount, profile_state.followingCount]);

  return {
    ...profile_state
  };
};
