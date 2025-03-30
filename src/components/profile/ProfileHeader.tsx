
import React, { useState } from 'react';
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
  profileImage: string;
  onProfileImageChange: (url: string) => void;
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
  profileImage,
  onProfileImageChange
}: ProfileHeaderProps) => {
  return (
    <>
      <ProfileCoverImage 
        coverImage={coverImage} 
        isLoading={isLoading} 
        onCoverImageChange={onCoverImageChange}
        onCoverImageUpdated={onCoverImageUpdated}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Card */}
          <ProfileCard 
            username={username}
            bio={bio}
            location={location}
            memberSince={memberSince}
            followingCount={followingCount}
            profileImage={profileImage}
            isLoading={isLoading}
            onProfileImageChange={onProfileImageChange}
          />
          
          {/* Content Area - This will be passed as children */}
          <div className="flex-1">
            {/* ProfileTabs will be rendered by the parent component */}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileHeader;
