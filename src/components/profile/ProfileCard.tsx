import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import ProfileEditForm from './ProfileEditForm';
import ProfileAvatar from './ProfileAvatar';
import ProfileActions from './ProfileActions';
import ProfileInfo from './ProfileInfo';
import ProfileUserInfo from './ProfileUserInfo';
import ProfileBadges from './ProfileBadges';
import { useProfileCardState } from './hooks/useProfileCardState';
import { useProfileSaveHandler } from './ProfileSaveHandler';
import { getFormattedDisplayName } from './ProfileDisplayHelper';

interface ProfileCardProps {
  username: string;
  bio: string;
  location: string;
  memberSince: string;
  followingCount: number;
  followerCount?: number;
  profileImage: string;
  isLoading: boolean;
  onProfileImageChange?: (url: string) => void;
  hasChanges: boolean;
  onSaveChanges?: () => void;
  isOwnProfile: boolean;
  profileUserId?: string;
  otherUserProfile?: any;
}

const ProfileCard = (props: ProfileCardProps) => {
  const { 
    username, 
    bio, 
    location, 
    memberSince, 
    followingCount,
    followerCount = 0, 
    profileImage,
    isLoading,
    onProfileImageChange,
    hasChanges,
    onSaveChanges,
    isOwnProfile,
    profileUserId,
    otherUserProfile
  } = props;

  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const {
    currentUsername,
    currentBio,
    currentLocation,
    databaseUsername,
    setDatabaseUsername,
    tempProfileImage,
    setTempProfileImage,
    localHasChanges,
    setLocalHasChanges,
    handleProfileUpdate
  } = useProfileCardState({
    username,
    bio,
    location,
    firstName,
    lastName,
    profileImage
  });

  const { handleSaveChanges } = useProfileSaveHandler({
    userId: user?.id,
    tempProfileImage,
    setTempProfileImage,
    setLocalHasChanges,
    hasChanges,
    onSaveChanges
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profileUserId) return;

      try {
        if (!isOwnProfile && otherUserProfile) {
          setDatabaseUsername(otherUserProfile.username || '');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', profileUserId)
          .single();

        if (error) throw error;

        if (data && data.username) {
          setDatabaseUsername(data.username);
        }
        
        if (user && isOwnProfile) {
          const userMetadata = user.user_metadata;
          setFirstName(userMetadata?.first_name || '');
          setLastName(userMetadata?.last_name || '');
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchUserData();
  }, [profileUserId, user, isOwnProfile, otherUserProfile]);

  const formattedUsername = databaseUsername 
    ? `@${databaseUsername.toLowerCase()}` 
    : '';

  const combinedHasChanges = hasChanges || localHasChanges;

  const displayName = getFormattedDisplayName(
    isOwnProfile, 
    firstName, 
    lastName, 
    currentUsername, 
    otherUserProfile
  );

  return (
    <>
      <Card className="relative shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 flex flex-col items-center">
          <ProfileAvatar 
            username={displayName}
            profileImage={profileImage}
            isLoading={isLoading}
            onProfileImageChange={onProfileImageChange}
            onImageSelected={setTempProfileImage}
            isEditable={isOwnProfile}
          />
          
          <ProfileUserInfo 
            username={displayName}
            bio={currentBio}
            isOwnProfile={isOwnProfile}
            formattedUsername={formattedUsername}
            onEditClick={isOwnProfile ? () => setIsEditModalOpen(true) : undefined}
          />
          
          <ProfileBadges isOwnProfile={isOwnProfile} />
          
          <ProfileActions 
            hasChanges={combinedHasChanges}
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
          username={databaseUsername || currentUsername}
          bio={currentBio}
          location={currentLocation}
          firstName={firstName}
          lastName={lastName}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </>
  );
};

export default ProfileCard;
