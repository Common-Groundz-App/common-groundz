
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, getDisplayName, fetchFollowerCount, fetchFollowingCount } from '@/services/profileService'; 
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
    setFollowingCount
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
  } = useProfileImages(defaultCoverImage);

  const {
    username,
    setUsername,
    bio,
    location,
    memberSince,
    setProfileMetadata
  } = useProfileMetadata();

  // Reset state when profile userId changes
  useEffect(() => {
    setProfileData(null);
    setError(null);
    setFollowerCount(0);
    setFollowingCount(0);
  }, [userId]);

  const loadProfileData = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const viewingUserId = userId;
      setIsOwnProfile(!userId || userId === user?.id);
      
      const profile = await fetchUserProfile(viewingUserId);
      
      // Fetch follower and following counts for the viewed profile
      const followerCountData = await fetchFollowerCount(viewingUserId);
      const followingCountData = await fetchFollowingCount(viewingUserId);
      
      setFollowerCount(followerCountData);
      setFollowingCount(followingCountData);
      
      setProfileData(profile);
      
      if (profile) {
        // For own profile, use user metadata. For other profiles, use profile data
        const displayName = isOwnProfile 
          ? getDisplayName(user, profile)
          : profile.username || 'User';
          
        setUsername(displayName);
        setProfileMetadata(isOwnProfile ? user?.user_metadata : null, profile);
        setInitialImages(profile);
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
