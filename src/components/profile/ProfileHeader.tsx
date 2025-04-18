import React from 'react';
import ProfileCoverImage from './ProfileCoverImage';
import ProfileCard from './ProfileCard';

interface ProfileHeaderProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange: (url: string) => void;
  onCoverImageUpdated: (url: string | null) => void;
  username: string;
  bio: string;
  location: string;
  memberSince: string;
  followingCount: number;
  followerCount?: number;
  profileImage: string;
  onProfileImageChange: (url: string) => void;
  hasChanges: boolean;
  onSaveChanges: () => void;
  isOwnProfile: boolean;
  profileUserId?: string;
}

const ProfileHeader = ({
  coverImage,
  isLoading,
  onCoverImageChange,
  onCoverImageUpdated,
  username,
  bio,
  location,
  memberSince,
  followingCount,
  followerCount = 0,
  profileImage,
  onProfileImageChange,
  hasChanges,
  onSaveChanges,
  isOwnProfile,
  profileUserId
}: ProfileHeaderProps) => {
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
};

export default ProfileHeader;
