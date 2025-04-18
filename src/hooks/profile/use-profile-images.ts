
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/services/profileService';

interface UseProfileImagesResult {
  coverImage: string;
  profileImage: string;
  tempCoverImage: string | null;
  hasChanges: boolean;
  handleProfileImageChange: (url: string) => void;
  handleCoverImageChange: (url: string) => void;
  handleCoverImageUpdated: (url: string | null) => void;
  handleSaveChanges: (userId: string) => Promise<void>;
}

export const useProfileImages = (defaultCoverImage: string): UseProfileImagesResult => {
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
    handleSaveChanges
  };
};
