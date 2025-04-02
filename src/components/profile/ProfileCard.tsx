
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
  const [mutualFollowers, setMutualFollowers] = useState<{count: number, examples: string[]}>({
    count: 0,
    examples: []
  });

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
          .select('username')
          .eq('id', profileUserId)
          .single();

        if (error) {
          console.error('Error fetching username:', error);
          return;
        }

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

  // Fetch mutual followers when viewing someone else's profile
  useEffect(() => {
    const fetchMutualFollows = async () => {
      if (isOwnProfile || !user || !profileUserId || !user.id) return;
      
      try {
        // Get users that the current user follows
        const { data: following, error: followingError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        if (followingError) throw followingError;
        
        if (!following || following.length === 0) return;
        
        const followingIds = following.map(f => f.following_id);
        
        // Get users that follow the profile user and are also followed by current user
        const { data: mutuals, error: mutualsError } = await supabase
          .from('follows')
          .select('follower_id, profiles:follower_id(username)')
          .eq('following_id', profileUserId)
          .in('follower_id', followingIds);
        
        if (mutualsError) throw mutualsError;
        
        if (mutuals && mutuals.length > 0) {
          // Extract usernames of up to 3 mutual followers
          const exampleUsernames = mutuals
            .slice(0, 3)
            .map(m => (m.profiles as any)?.username || '')
            .filter(Boolean);
          
          setMutualFollowers({
            count: mutuals.length,
            examples: exampleUsernames
          });
        }
      } catch (error) {
        console.error('Error fetching mutual followers:', error);
      }
    };
    
    fetchMutualFollows();
  }, [isOwnProfile, profileUserId, user]);

  const formattedUsername = databaseUsername 
    ? `@${databaseUsername}` 
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
      <Card className="relative bg-white shadow-lg rounded-lg overflow-hidden">
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
            mutualFollows={!isOwnProfile ? mutualFollowers : undefined}
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
