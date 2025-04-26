
import React from 'react';
import ProfileCoverImage from './ProfileCoverImage';

interface ProfileHeaderProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange: (url: string) => void;
  onCoverImageUpdated: (url: string | null) => void;
  isOwnProfile: boolean;
}

const ProfileHeader = ({
  coverImage,
  isLoading,
  onCoverImageChange,
  onCoverImageUpdated,
  isOwnProfile
}: ProfileHeaderProps) => {
  return (
    <div className="relative">
      <ProfileCoverImage 
        coverImage={coverImage} 
        isLoading={isLoading} 
        onCoverImageChange={onCoverImageChange} 
        onCoverImageUpdated={onCoverImageUpdated} 
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
};

export default ProfileHeader;
