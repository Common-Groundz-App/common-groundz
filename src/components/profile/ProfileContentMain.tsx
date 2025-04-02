
import React from 'react';
import ProfileHeader from './ProfileHeader';
import ProfileTabs from './ProfileTabs';
import { useProfileData } from '@/hooks/use-profile-data';

interface ProfileContentMainProps {
  viewingOwnProfile: boolean;
  profileUserId: string;
  otherUserProfile: any;
  otherUserFollowing: number;
  otherUserFollowers: number;
  loadingOtherProfile: boolean;
}

const ProfileContentMain = ({
  viewingOwnProfile,
  profileUserId,
  otherUserProfile,
  otherUserFollowing,
  otherUserFollowers,
  loadingOtherProfile
}: ProfileContentMainProps) => {
  // Use the hook to get current user's profile data
  const {
    isLoading,
    coverImage,
    profileImage,
    username,
    bio,
    location,
    memberSince,
    followingCount,
    followerCount,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges
  } = useProfileData();

  // Get display data based on whether viewing own or other profile
  const getDisplayData = () => {
    if (viewingOwnProfile) {
      return {
        coverImage,
        profileImage,
        username,
        bio,
        location,
        memberSince,
        followingCount,
        followerCount,
        isLoading,
      };
    } else {
      return {
        coverImage: otherUserProfile?.cover_url || '',
        profileImage: otherUserProfile?.avatar_url || '',
        username: otherUserProfile?.username || 'User',
        bio: otherUserProfile?.bio || 'No bio available',
        location: otherUserProfile?.location || '',
        memberSince,
        followingCount: otherUserFollowing,
        followerCount: otherUserFollowers,
        isLoading: loadingOtherProfile,
      };
    }
  };

  const displayData = getDisplayData();

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      <ProfileHeader 
        coverImage={displayData.coverImage}
        isLoading={displayData.isLoading}
        onCoverImageChange={handleCoverImageChange}
        onCoverImageUpdated={handleCoverImageUpdated}
        username={displayData.username}
        bio={displayData.bio}
        location={displayData.location}
        memberSince={displayData.memberSince}
        followingCount={displayData.followingCount}
        followerCount={displayData.followerCount}
        profileImage={displayData.profileImage}
        onProfileImageChange={handleProfileImageChange}
        hasChanges={hasChanges}
        onSaveChanges={handleSaveChanges}
        isOwnProfile={viewingOwnProfile}
        profileUserId={profileUserId}
        otherUserProfile={otherUserProfile}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Content Column - takes remaining space */}
          <div className="flex-1 flex flex-col w-full py-0 px-[16px]">
            <ProfileTabs profileUserId={profileUserId} isOwnProfile={viewingOwnProfile} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContentMain;
