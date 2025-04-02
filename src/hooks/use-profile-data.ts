
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useProfileImages } from '@/hooks/use-profile-images';
import { useProfileMetadata } from '@/hooks/use-profile-metadata';
import { 
  fetchUserProfile, 
  fetchFollowingCount, 
  fetchFollowerCount, 
  updateUserProfile,
  getDisplayName
} from '@/services/profileService';

export const useProfileData = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Default cover image with a nice pattern
  const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';
  
  // Use the extracted hooks
  const {
    coverImage,
    profileImage,
    tempCoverImage,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    setInitialImages,
    setHasChanges
  } = useProfileImages({ defaultCoverImage });

  const {
    username,
    setUsername,
    bio,
    location,
    memberSince,
    followingCount,
    followerCount,
    setProfileMetadata,
    updateCounts
  } = useProfileMetadata();
  
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
          const followingData = await fetchFollowingCount(user.id);
          const followerData = await fetchFollowerCount(user.id);
          
          // Update counts
          updateCounts(followingData, followerData);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user]);

  // Check for changes that need to be saved
  useEffect(() => {
    setHasChanges(!!tempCoverImage);
  }, [tempCoverImage]);

  // Save all profile changes
  const handleSaveChanges = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Prepare update object
      const updates: any = {};
      
      // Add cover image if it was changed
      if (tempCoverImage) {
        updates.cover_url = tempCoverImage;
      }
      
      // Only update if we have changes
      if (Object.keys(updates).length > 0) {
        await updateUserProfile(user.id, updates);
        
        // Clear temporary state
        setHasChanges(false);
        
        // Notify user
        toast({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated.'
        });
        
        // Refresh the UserMenu
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

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
    handleSaveChanges
  };
};
