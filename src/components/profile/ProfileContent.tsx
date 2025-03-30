
import React from 'react';
import ProfileCard from './ProfileCard';
import ProfileCoverImage from './ProfileCoverImage';
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

  return <div className="w-full bg-background pt-16 md:pt-20">
      {/* Cover Image */}
      <ProfileCoverImage coverImage={coverImage} isLoading={isLoading} onCoverImageChange={handleCoverImageChange} onCoverImageUpdated={handleCoverImageUpdated} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        {/* Flex container for profile card and content */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Profile Card - center on mobile, fixed width on desktop */}
          <div className="w-full flex justify-center md:justify-start md:w-[300px] flex-shrink-0">
            <div className="w-full max-w-[300px] md:w-full">
              <ProfileCard username={username} bio={bio} location={location} memberSince={memberSince} followingCount={followingCount} profileImage={profileImage} isLoading={isLoading} onProfileImageChange={handleProfileImageChange} hasChanges={hasChanges} onSaveChanges={handleSaveChanges} />
            </div>
          </div>
          
          {/* Content Column - takes remaining space */}
          <div className="flex-1 flex flex-col w-full py-0 px-[16px]">
            <ProfileTabs />
          </div>
        </div>
      </div>
    </div>;
};

export default ProfileContent;
