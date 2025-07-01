
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/use-profile-cache';
import { fetchFollowerCount, fetchFollowingCount } from '@/services/profileService'; 
import { useProfileFollows } from './profile/use-profile-follows';
import { useProfileImages } from './profile/use-profile-images';
import { useProfileMetadata } from './profile/use-profile-metadata';
import { supabase } from '@/integrations/supabase/client';

const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';

export const useProfileData = (userId?: string) => {
  const { user } = useAuth();
  const [error, setError] = useState<Error | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);

  // Don't use fallback to current user - if no userId provided, this should error
  const viewingUserId = userId;
  
  // Use the enhanced profile service instead of direct fetching
  const { data: profile, isLoading } = useProfile(viewingUserId);

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

  // Fetch raw profile data to get cover_url - only for the specific user
  const { data: rawProfile } = useQuery({
    queryKey: ['rawProfile', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('cover_url, avatar_url')
        .eq('id', viewingUserId)
        .single();
      
      if (error) {
        console.error('Error fetching raw profile:', error);
        return null;
      }
      return data;
    },
    enabled: !!viewingUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Use React Query to fetch follower and following counts
  const { data: followerCountData } = useQuery({
    queryKey: ['followerCount', viewingUserId],
    queryFn: () => fetchFollowerCount(viewingUserId as string),
    enabled: !!viewingUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
  
  const { data: followingCountData } = useQuery({
    queryKey: ['followingCount', viewingUserId],
    queryFn: () => fetchFollowingCount(viewingUserId as string),
    enabled: !!viewingUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user || !viewingUserId) return;
    
    try {
      // Check if viewing own profile
      setIsOwnProfile(viewingUserId === user.id);
      
      if (profile && rawProfile) {
        console.log("Enhanced profile data loaded for user:", viewingUserId, profile);
        console.log("Raw profile data loaded:", rawProfile);
        
        // Use displayName which now prioritizes first_name + last_name
        setUsername(profile.displayName);
        setProfileMetadata(user.user_metadata, { 
          username: profile.username,
          bio: profile.bio,
          location: profile.location 
        });
        
        // Set images for the specific user being viewed
        setInitialImages({ 
          id: viewingUserId,
          avatar_url: rawProfile.avatar_url,
          cover_url: rawProfile.cover_url 
        });
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load profile data'));
    }
  }, [user, viewingUserId, profile, rawProfile, setUsername, setProfileMetadata, setInitialImages]);
  
  // Update follower and following counts when data changes
  useEffect(() => {
    if (followerCountData !== undefined) {
      setFollowerCount(followerCountData);
    }
  }, [followerCountData, setFollowerCount]);
  
  useEffect(() => {
    if (followingCountData !== undefined) {
      setFollowingCount(followingCountData);
    }
  }, [followingCountData, setFollowingCount]);

  return {
    isLoading,
    error,
    profileData: profile,
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
    handleSaveChanges: () => handleSaveChanges(viewingUserId || '')
  };
};
