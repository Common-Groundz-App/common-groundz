
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, getDisplayName, fetchFollowerCount, fetchFollowingCount } from '@/services/profileService'; 
import { useProfileFollows } from './profile/use-profile-follows';
import { useProfileImages } from './profile/use-profile-images';
import { useProfileMetadata } from './profile/use-profile-metadata';
import { useQuery } from '@tanstack/react-query';

const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';

export const useProfileData = (userId?: string) => {
  const { user } = useAuth();
  const [error, setError] = useState<Error | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
  
  const profileUserId = userId || user?.id;
  
  // Use React Query for caching profile data
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile', profileUserId],
    queryFn: async () => {
      if (!user) return null;
      try {
        const viewingUserId = profileUserId;
        setIsOwnProfile(!userId || userId === user.id);
        
        return await fetchUserProfile(viewingUserId);
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err : new Error('Failed to load profile data'));
        return null;
      }
    },
    enabled: !!user && !!profileUserId,
    staleTime: 5 * 60 * 1000, // Keep profile data fresh for 5 minutes
  });

  // Use React Query for follower count with separate cache entry
  const { data: followerCount = 0 } = useQuery({
    queryKey: ['followerCount', profileUserId],
    queryFn: () => fetchFollowerCount(profileUserId || ''),
    enabled: !!profileUserId,
    staleTime: 2 * 60 * 1000, // Keep follower count fresh for 2 minutes
  });

  // Use React Query for following count with separate cache entry
  const { data: followingCount = 0 } = useQuery({
    queryKey: ['followingCount', profileUserId],
    queryFn: () => fetchFollowingCount(profileUserId || ''),
    enabled: !!profileUserId,
    staleTime: 2 * 60 * 1000, // Keep following count fresh for 2 minutes
  });

  const {
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

  // Set profile metadata when profile data changes
  if (profileData && user) {
    const displayName = getDisplayName(user, profileData);
    setUsername(displayName);
    setProfileMetadata(user.user_metadata, profileData);
    setInitialImages(profileData);
    setFollowerCount(followerCount);
    setFollowingCount(followingCount);
  }

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
