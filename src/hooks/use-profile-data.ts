
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, fetchFollowerCount, fetchFollowingCount } from '@/services/profileService'; 
import { useProfileFollows } from './profile/use-profile-follows';
import { useProfileImages } from './profile/use-profile-images';
import { useProfileMetadata } from './profile/use-profile-metadata';

const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';

export const useProfileData = (userId?: string) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  const {
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount,
    refreshCounts
  } = useProfileFollows(userId);

  const {
    coverImage,
    profileImage,
    tempCoverImage,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges,
    setInitialImages
  } = useProfileImages({ defaultCoverImage });

  const {
    username,
    setUsername,
    bio,
    setBio,
    location,
    setLocation,
    memberSince,
    setProfileMetadata,
    updateCounts
  } = useProfileMetadata();

  // Reset state when profile userId changes
  useEffect(() => {
    setProfileData(null);
    setError(null);
    setFollowerCount(0);
    setFollowingCount(0);
    setBio('');
    setLocation('');
  }, [userId]);

  const loadProfileData = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const viewingUserId = userId;
      const isOwn = !userId || userId === user?.id;
      setIsOwnProfile(isOwn);
      
      const profile = await fetchUserProfile(viewingUserId);
      
      // Fetch follower and following counts
      const [followerCountData, followingCountData] = await Promise.all([
        fetchFollowerCount(viewingUserId),
        fetchFollowingCount(viewingUserId)
      ]);
      
      updateCounts(followingCountData, followerCountData);
      setProfileData(profile);
      
      if (profile) {
        setInitialImages(profile);
        setProfileMetadata(isOwn ? user?.user_metadata : null, profile);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load profile data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [user, userId]);

  useEffect(() => {
    // Listen for follow/unfollow events to update counts
    const handleFollowStatusChange = (event: CustomEvent) => {
      if (!userId) return;
      
      const { follower, following, action } = event.detail;
      
      if (userId === following) {
        const change = action === 'follow' ? 1 : -1;
        setFollowerCount(prev => Math.max(0, prev + change));
      }
      
      if (userId === follower) {
        refreshCounts();
      }
    };

    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    };
  }, [userId, refreshCounts]);

  return {
    isLoading,
    error,
    profileData,
    isOwnProfile,
    coverImage,
    profileImage,
    username,
    bio,
    location,
    memberSince,
    followingCount,
    followerCount,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges: () => handleSaveChanges(user?.id || '')
  };
};
