
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/services/profileService';

interface UseProfileImagesProps {
  defaultCoverImage: string;
}

export const useProfileImages = ({ defaultCoverImage }: UseProfileImagesProps) => {
  const [coverImage, setCoverImage] = useState<string>(defaultCoverImage);
  const [profileImage, setProfileImage] = useState<string>('');
  const [tempCoverImage, setTempCoverImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setHasChanges(!!tempCoverImage);
  }, [tempCoverImage]);

  const handleProfileImageChange = (url: string) => {
    setProfileImage(url);
  };

  const handleCoverImageChange = (url: string) => {
    setCoverImage(url);
  };

  const handleCoverImageUpdated = (url: string | null) => {
    setTempCoverImage(url);
  };
  
  const setInitialImages = (profileData: any) => {
    if (profileData?.avatar_url) {
      // Add timestamp to force browser to reload the image
      setProfileImage(profileData.avatar_url + '?t=' + new Date().getTime());
    } else {
      setProfileImage(''); // Empty string to trigger initials avatar
    }
    
    if (profileData?.cover_url) {
      // Add timestamp to force browser to reload the image
      setCoverImage(profileData.cover_url + '?t=' + new Date().getTime());
    } else {
      setCoverImage(defaultCoverImage);
    }
  };

  const handleSaveChanges = async (userId: string) => {
    try {
      if (tempCoverImage) {
        await updateUserProfile(userId, { cover_url: tempCoverImage });
        setTempCoverImage(null);
        setHasChanges(false);
        toast({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated.'
        });
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
      throw error;
    }
  };

  return {
    coverImage,
    profileImage,
    tempCoverImage,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges,
    setInitialImages
  };
};
