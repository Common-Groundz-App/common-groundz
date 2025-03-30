
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
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges
  } = useProfileData();

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      {/* Profile Header Section (includes Cover Photo and Profile Card) */}
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
      />
      
      {/* Content Area (the tabs) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Card (invisible placeholder to maintain layout) */}
          <div className="md:w-[350px] hidden md:block"></div>
          
          {/* Content Area with Tabs */}
          <div className="flex-1">
            <ProfileTabs />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
