
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProfileContentSkeleton from './ProfileContentSkeleton';
import ProfileContentMain from './ProfileContentMain';
import { useProfilePageState } from './hooks/useProfilePageState';

const ProfileContent = () => {
  const { user } = useAuth();
  const {
    viewingOwnProfile,
    profileUserId,
    otherUserProfile,
    loadingOtherProfile,
    otherUserFollowing,
    otherUserFollowers
  } = useProfilePageState();

  // Show loading state while determining profile
  if ((!user) || (viewingOwnProfile && !profileUserId) || (!viewingOwnProfile && !otherUserProfile && !loadingOtherProfile)) {
    return <ProfileContentSkeleton />;
  }

  return (
    <ProfileContentMain
      viewingOwnProfile={viewingOwnProfile}
      profileUserId={profileUserId}
      otherUserProfile={otherUserProfile}
      otherUserFollowing={otherUserFollowing}
      otherUserFollowers={otherUserFollowers}
      loadingOtherProfile={loadingOtherProfile}
    />
  );
};

export default ProfileContent;
