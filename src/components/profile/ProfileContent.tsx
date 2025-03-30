
import React from 'react';
import ProfileHeader from './ProfileHeader';
import ProfileTabs from './ProfileTabs';
import { useProfileData } from '@/hooks/use-profile-data';

const ProfileContent = () => {
  const {
    isLoading,
    coverImage,
    profileImage,
    username,
    bio,
    location,
    memberSince,
    followingCount,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges
  } = useProfileData();

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      {/* Cover Image */}
      <ProfileHeader 
        coverImage={coverImage}
        isLoading={isLoading}
        onCoverImageChange={handleCoverImageChange}
        onCoverImageUpdated={handleCoverImageUpdated}
        username={username}
        bio={bio}
        location={location}
        memberSince={memberSince}
        followingCount={followingCount}
        profileImage={profileImage}
        onProfileImageChange={handleProfileImageChange}
        hasChanges={hasChanges}
        onSaveChanges={handleSaveChanges}
      />
      
      {/* Tabs directly below cover image */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <ProfileTabs />
      </div>
    </div>
  );
};

export default ProfileContent;
