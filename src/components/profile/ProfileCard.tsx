import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProfileEditForm from './ProfileEditForm';
import ProfileAvatar from './ProfileAvatar';
import ProfileActions from './ProfileActions';
import ProfileInfo from './ProfileInfo';
import ProfileUserInfo from './ProfileUserInfo';

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
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentBio, setCurrentBio] = useState(bio);
  const [currentLocation, setCurrentLocation] = useState(location);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [localHasChanges, setLocalHasChanges] = useState(false);
  const [databaseUsername, setDatabaseUsername] = useState<string>('');

  // Get the actual username from the database and user metadata
  useEffect(() => {
    const fetchUserData = async () => {
      if (!profileUserId) return;

      try {
        // If we're viewing another user's profile and already have their data, use it
        if (!isOwnProfile && otherUserProfile) {
          setDatabaseUsername(otherUserProfile.username || '');
          return;
        }

        // Otherwise fetch from the database
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
        
        // Get user metadata for first/last name (only for own profile)
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

  // Format username for display (use database username if available)
  const formattedUsername = databaseUsername 
    ? `@${databaseUsername}` 
    : '';

  // Update states when props change
  useEffect(() => {
    setCurrentUsername(username);
    setCurrentBio(bio);
    setCurrentLocation(location);
  }, [username, bio, location]);

  // Check if there are changes to save
  useEffect(() => {
    setLocalHasChanges(!!tempProfileImage);
  }, [tempProfileImage]);

  const handleSaveChanges = async () => {
    if (!user) return;
    
    try {
      // If we have local profile image changes
      if (tempProfileImage) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: tempProfileImage })
          .eq('id', user.id);
        
        if (updateError) {
          toast({
            title: 'Failed to update profile',
            description: updateError.message,
            variant: 'destructive'
          });
          return;
        }
        
        // Clear the temporary state
        setTempProfileImage(null);
        setLocalHasChanges(false);
        
        // Refresh the UserMenu component by triggering a global event
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
      
      // Forward to parent's save handler for any other changes (like cover image)
      if (hasChanges && onSaveChanges) {
        onSaveChanges();
      }
      
      toast({
        title: 'Profile saved',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  const handleProfileUpdate = (
    newUsername: string, 
    newBio: string, 
    newLocation: string, 
    newFirstName: string, 
    newLastName: string
  ) => {
    setCurrentUsername(newUsername);
    setCurrentBio(newBio);
    setCurrentLocation(newLocation);
    setFirstName(newFirstName);
    setLastName(newLastName);
    setDatabaseUsername(newUsername);
  };

  // Combine local changes with Parent Component Changes
  const combinedHasChanges = hasChanges || localHasChanges;

  // Build display name
  let displayName = currentUsername;
  
  // For own profile, use first/last name if available
  if (isOwnProfile) {
    displayName = firstName || lastName 
      ? `${firstName} ${lastName}`.trim() 
      : currentUsername;
  }
  // For other user's profile, prioritize their username from the database
  else if (otherUserProfile) {
    displayName = otherUserProfile.username || currentUsername;
  }

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
          />
          
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
