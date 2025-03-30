
import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ProfileHeader from './ProfileHeader';
import ProfileTabs from './ProfileTabs';
import ProfileSkeleton from './ProfileSkeleton';
import { useProfileDisplayData } from '@/hooks/use-profile-display-data';

const ProfileContent = () => {
  const { user } = useAuth();
  const { userId } = useParams(); // Get userId from URL if available
  
  // Custom hook to handle profile data display
  const { displayData, profileUserId, viewingOwnProfile, isLoading } = useProfileDisplayData(userId, user?.id);

  // Show loading state while determining profile
  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      {/* Profile Header with Cover Image and Profile Card */}
      <ProfileHeader 
        coverImage={displayData.coverImage}
        isLoading={displayData.isLoading}
        onCoverImageChange={displayData.handleCoverImageChange}
        onCoverImageUpdated={displayData.handleCoverImageUpdated}
        username={displayData.username}
        bio={displayData.bio}
        location={displayData.location}
        memberSince={displayData.memberSince}
        followingCount={displayData.followingCount}
        profileImage={displayData.profileImage}
        onProfileImageChange={displayData.handleProfileImageChange}
        hasChanges={displayData.hasChanges}
        onSaveChanges={displayData.handleSaveChanges}
        isOwnProfile={viewingOwnProfile}
        profileUserId={profileUserId}
      />
      
      {/* Profile Content Column */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Empty div for spacing to align with profile card */}
          <div className="w-full md:w-[300px] flex-shrink-0 hidden md:block"></div>
          
          {/* Content Column - takes remaining space */}
          <div className="flex-1 flex flex-col w-full py-0 px-[16px]">
            <ProfileTabs profileUserId={profileUserId} isOwnProfile={viewingOwnProfile} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
