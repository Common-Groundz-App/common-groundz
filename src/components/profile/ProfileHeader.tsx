
import React, { memo } from 'react';
import ProfileCoverImage from './ProfileCoverImage';

interface ProfileHeaderProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange: (url: string) => void;
  onCoverImageUpdated: (url: string | null) => void;
  username?: string;
  bio?: string;
  location?: string;
  memberSince?: string;
  followingCount?: number;
  followerCount?: number;
  profileImage?: string;
  onProfileImageChange?: (url: string) => void;
  hasChanges?: boolean;
  onSaveChanges?: () => void;
  isOwnProfile?: boolean;
  profileUserId?: string;
}

// Memoize the component to prevent unnecessary re-renders
const ProfileHeader = memo(({
  coverImage,
  isLoading,
  onCoverImageChange,
  onCoverImageUpdated
}: ProfileHeaderProps) => {
  console.log("ProfileHeader rendering with coverImage:", coverImage);
  
  return (
    <div className="relative">
      <ProfileCoverImage 
        coverImage={coverImage} 
        isLoading={isLoading} 
        onCoverImageChange={onCoverImageChange} 
        onCoverImageUpdated={onCoverImageUpdated} 
      />
    </div>
  );
});

ProfileHeader.displayName = 'ProfileHeader';

export default ProfileHeader;
