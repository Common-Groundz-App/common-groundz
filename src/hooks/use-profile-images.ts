
import { useState } from 'react';

interface UseProfileImagesProps {
  defaultCoverImage: string;
}

export const useProfileImages = ({ defaultCoverImage }: UseProfileImagesProps) => {
  const [coverImage, setCoverImage] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [tempCoverImage, setTempCoverImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Handler for profile image update
  const handleProfileImageChange = (url: string) => {
    setProfileImage(url);
  };

  // Handler for cover image update
  const handleCoverImageChange = (url: string) => {
    setCoverImage(url);
  };

  // Handler for temporary cover image (before saving)
  const handleCoverImageUpdated = (url: string | null) => {
    console.log("Setting tempCoverImage to:", url);
    setTempCoverImage(url);
    setHasChanges(true);
  };

  // Set initial images from profile data
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

  return {
    coverImage,
    profileImage,
    tempCoverImage,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    setInitialImages,
    setHasChanges
  };
};
