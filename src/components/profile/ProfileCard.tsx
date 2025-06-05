
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import ProfileEditForm from './ProfileEditForm';
import ProfileAvatar from './ProfileAvatar';
import ProfileActions from './ProfileActions';
import ProfileInfo from './ProfileInfo';
import ProfileUserInfo from './ProfileUserInfo';
import ProfileBadges from './ProfileBadges';
import { useViewedProfile } from '@/hooks/use-viewed-profile';
import { useProfileCardState } from './hooks/useProfileCardState';
import { useProfileSaveHandler } from './ProfileSaveHandler';

interface ProfileCardProps {
  profileUserId?: string;
}

const ProfileCard = ({ profileUserId }: ProfileCardProps) => {
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const {
    username,
    bio,
    location,
    avatarUrl,
    createdAt,
    displayName,
    followerCount,
    followingCount,
    isLoading,
    error,
    isOwnProfile
  } = useViewedProfile(profileUserId);

  const {
    currentUsername,
    currentBio,
    currentLocation,
    tempProfileImage,
    setTempProfileImage,
    localHasChanges,
    setLocalHasChanges,
    handleProfileUpdate
  } = useProfileCardState({
    username: username || '',
    bio: bio || '',
    location: location || '',
    firstName: user?.user_metadata?.first_name || '',
    lastName: user?.user_metadata?.last_name || '',
    profileImage: avatarUrl || ''
  });

  const { handleSaveChanges } = useProfileSaveHandler({
    userId: user?.id,
    tempProfileImage,
    setTempProfileImage,
    setLocalHasChanges,
    hasChanges: localHasChanges,
  });

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-red-500">Error loading profile: {error.message}</p>
      </Card>
    );
  }

  const memberSince = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });

  const formattedUsername = username ? `@${username}` : '';

  return (
    <>
      <Card className="relative shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 flex flex-col items-center">
          <ProfileAvatar 
            username={displayName}
            profileImage={avatarUrl || ''}
            isLoading={isLoading}
            isEditable={isOwnProfile}
          />
          
          <ProfileUserInfo 
            username={username || ''}
            bio={currentBio}
            isOwnProfile={isOwnProfile}
            formattedUsername={formattedUsername}
            onEditClick={isOwnProfile ? () => setIsEditModalOpen(true) : undefined}
            displayName={displayName}
          />
          
          <ProfileBadges isOwnProfile={isOwnProfile} />
          
          <ProfileActions 
            hasChanges={localHasChanges}
            isLoading={isLoading}
            uploading={false}
            onSaveChanges={handleSaveChanges}
            profileUserId={profileUserId}
            isOwnProfile={isOwnProfile}
          />
          
          <ProfileInfo 
            location={currentLocation}
            memberSince={memberSince}
            followingCount={followingCount}
            followerCount={followerCount}
            profileUserId={profileUserId}
            isOwnProfile={isOwnProfile}
          />
        </div>
      </Card>

      {isOwnProfile && (
        <ProfileEditForm 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          username={username || currentUsername}
          bio={currentBio}
          location={currentLocation}
          firstName={user?.user_metadata?.first_name || ''}
          lastName={user?.user_metadata?.last_name || ''}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </>
  );
};

export default ProfileCard;
