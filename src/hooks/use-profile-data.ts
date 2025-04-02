
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useProfileImages } from '@/hooks/use-profile-images';
import { useProfileMetadata } from '@/hooks/use-profile-metadata';
import { useProfileCounts } from '@/hooks/use-profile-counts';
import { useProfileSave } from '@/hooks/use-profile-save';
import { fetchUserProfile, getDisplayName } from '@/services/profileService';

export const useProfileData = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Default cover image with a nice pattern
  const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';
  
  // Use the extracted hooks
  const {
    coverImage,
    profileImage,
    tempCoverImage,
    hasChanges: imageHasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    setInitialImages,
    setHasChanges: setImageHasChanges
  } = useProfileImages({ defaultCoverImage });

  const {
    username,
    setUsername,
    bio,
    location,
    memberSince,
    setProfileMetadata
  } = useProfileMetadata();

  const {
    followerCount,
    followingCount,
    fetchCounts
  } = useProfileCounts(user?.id);

  const {
    hasChanges: saveHasChanges,
    setHasChanges: setSaveHasChanges,
    handleSaveChanges
  } = useProfileSave(user?.id);
  
  // Check for changes that need to be saved
  useEffect(() => {
    setSaveHasChanges(!!tempCoverImage);
  }, [tempCoverImage, setSaveHasChanges]);
  
  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Get profile data from profiles table
        const profileData = await fetchUserProfile(user.id);
        
        if (profileData) {
          console.log('Profile data loaded:', profileData);
          
          // Get user metadata from auth
          const userMetadata = user.user_metadata;
          
          // Set display name
          const displayName = getDisplayName(user, profileData);
          setUsername(displayName);
          
          // Set profile metadata
          setProfileMetadata(userMetadata, profileData);
          
          // Set profile and cover images
          setInitialImages(profileData);
          
          // Fetch following and follower counts
          await fetchCounts(user.id);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user, setInitialImages, setProfileMetadata, setUsername, fetchCounts]);

  // Save all profile changes
  const saveChanges = async () => {
    if (!user) return;
    
    // Prepare update object
    const updates: any = {};
    
    // Add cover image if it was changed
    if (tempCoverImage) {
      updates.cover_url = tempCoverImage;
    }
    
    // Only update if we have changes
    await handleSaveChanges(updates);
  };

  // Combined hasChanges from both image changes and other changes
  const hasChanges = imageHasChanges || saveHasChanges;

  return {
    isLoading,
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
    handleSaveChanges: saveChanges
  };
};
