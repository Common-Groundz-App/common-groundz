
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, getDisplayName } from '@/services/profileService'; 
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

  const loadProfileData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const viewingUserId = userId || user.id;
      setIsOwnProfile(!userId || userId === user.id);
      
      const profile = await fetchUserProfile(viewingUserId);
      setProfileData(profile);
      
      if (profile) {
        const displayName = getDisplayName(user, profile);
        setUsername(displayName);
        setProfileMetadata(user.user_metadata, profile);
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
