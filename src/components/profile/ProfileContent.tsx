
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
      {/* Profile Header Section with Tabs inside */}
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
      >
        <ProfileTabs />
      </ProfileHeader>
    </div>
  );
};

export default ProfileContent;
