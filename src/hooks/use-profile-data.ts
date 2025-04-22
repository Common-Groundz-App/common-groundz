
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, getDisplayName } from '@/services/profileService'; 
import { useProfileFollows } from './profile/use-profile-follows';
import { useProfileImages } from './profile/use-profile-images';
import { useProfileMetadata } from './profile/use-profile-metadata';
import { fetchUserPosts } from '@/components/profile/services/profilePostsService';

// Mock data for recommendations and reviews until we implement proper services
const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';

export const useProfileData = (userId?: string) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [postsData, setPostsData] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<Error | null>(null);
  const [recommendationsData, setRecommendationsData] = useState<any[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [reviewsData, setReviewsData] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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

  const loadPosts = async () => {
    if (!user) return;
    
    try {
      setPostsLoading(true);
      const viewingUserId = userId || user.id;
      const isOwn = !userId || userId === user.id;
      
      const posts = await fetchUserPosts(viewingUserId, isOwn);
      setPostsData(posts);
    } catch (err) {
      console.error('Error loading posts:', err);
      setPostsError(err instanceof Error ? err : new Error('Failed to load posts'));
    } finally {
      setPostsLoading(false);
    }
  };

  // For recommendations - using mock data for now until we implement the service
  const loadRecommendations = async () => {
    setRecommendationsLoading(true);
    // Mock data for now
    setTimeout(() => {
      setRecommendationsData([]);
      setRecommendationsLoading(false);
    }, 500);
  };

  // For reviews - using mock data for now until we implement the service
  const loadReviews = async () => {
    setReviewsLoading(true);
    // Mock data for now
    setTimeout(() => {
      setReviewsData([]);
      setReviewsLoading(false);
    }, 500);
  };

  useEffect(() => {
    loadProfileData();
    loadPosts();
    loadRecommendations();
    loadReviews();
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
    handleSaveChanges: () => handleSaveChanges(user?.id || ''),
    posts: {
      posts: postsData,
      isLoading: postsLoading,
      error: postsError
    },
    recommendations: {
      recommendations: recommendationsData,
      isLoading: recommendationsLoading,
    },
    reviews: {
      reviews: reviewsData,
      isLoading: reviewsLoading,
    }
  };
};
