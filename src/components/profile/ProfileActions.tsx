
import React from 'react';
import SaveChangesButton from './actions/SaveChangesButton';
import FollowButton from './actions/FollowButton';
import MessageButton from './actions/MessageButton';
import { useFollow } from '@/hooks/use-follow';

interface ProfileActionsProps {
  hasChanges: boolean;
  isLoading: boolean;
  uploading?: boolean;
  onSaveChanges: () => void;
  profileUserId?: string;
  isOwnProfile: boolean;
}

const ProfileActions = ({ 
  hasChanges, 
  isLoading, 
  uploading = false, 
  onSaveChanges,
  profileUserId,
  isOwnProfile
}: ProfileActionsProps) => {
  const { isFollowing, followLoading, handleFollowToggle } = useFollow(profileUserId);

  if (isOwnProfile) {
    return (
      <div className="flex space-x-3 mb-6">
        <SaveChangesButton 
          hasChanges={hasChanges} 
          isLoading={isLoading} 
          uploading={uploading} 
          onSaveChanges={onSaveChanges} 
        />
      </div>
    );
  }

  return (
    <div className="flex space-x-3 mb-6">
      <FollowButton 
        isFollowing={isFollowing} 
        isLoading={followLoading} 
        onFollowToggle={handleFollowToggle} 
      />
      <MessageButton />
    </div>
  );
};

export default ProfileActions;
