
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import ProfileEditForm from './ProfileEditForm';
import ProfileAvatar from './ProfileAvatar';
import ProfileActions from './ProfileActions';
import ProfileInfo from './ProfileInfo';
import ProfileUserInfo from './ProfileUserInfo';
import ProfileBadges from './ProfileBadges';
import { ProfileData } from '@/hooks/use-viewed-profile';
import { useToast } from '@/hooks/use-toast';

interface ProfileCardProps {
  profileData: ProfileData;
  username: string;
  formattedUsername: string;
  bio: string;
  location: string;
  memberSince: string;
  followingCount: number;
  followerCount: number;
  profileImage: string;
  isLoading: boolean;
  isOwnProfile: boolean;
}

interface ProfileUpdates {
  username?: string;
  bio?: string;
  location?: string;
  firstName?: string;
  lastName?: string;
}

const ProfileCard = (props: ProfileCardProps) => {
  const { 
    profileData,
    username, 
    formattedUsername,
    bio, 
    location, 
    memberSince, 
    followingCount,
    followerCount, 
    profileImage,
    isLoading,
    isOwnProfile
  } = props;

  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [localHasChanges, setLocalHasChanges] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleProfileUpdate = async (updates: ProfileUpdates) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: updates.username,
          bio: updates.bio,
          location: updates.location,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated'
      });
      
      // Dispatch event to refresh profile
      window.dispatchEvent(new CustomEvent('profile-updated'));
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!isOwnProfile || !user) return;
    
    try {
      setUpdatingProfile(true);
      
      if (tempProfileImage) {
        await supabase
          .from('profiles')
          .update({ avatar_url: tempProfileImage })
          .eq('id', user.id);
        
        setTempProfileImage(null);
        setLocalHasChanges(false);
        
        toast({
          title: 'Profile updated',
          description: 'Your profile image has been updated'
        });
        
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <>
      <Card className="relative shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 flex flex-col items-center">
          <ProfileAvatar 
            username={username}
            profileImage={profileImage}
            isLoading={isLoading}
            onImageSelected={setTempProfileImage}
            isEditable={isOwnProfile}
          />
          
          <ProfileUserInfo 
            username={username}
            bio={bio}
            isOwnProfile={isOwnProfile}
            formattedUsername={formattedUsername}
            onEditClick={isOwnProfile ? () => setIsEditModalOpen(true) : undefined}
          />
          
          <ProfileBadges isOwnProfile={isOwnProfile} />
          
          <ProfileActions 
            hasChanges={localHasChanges}
            isLoading={updatingProfile}
            uploading={false}
            onSaveChanges={handleSaveChanges}
            profileUserId={profileData.id}
            isOwnProfile={isOwnProfile}
          />
          
          <ProfileInfo 
            location={location}
            memberSince={memberSince}
            followingCount={followingCount}
            followerCount={followerCount}
            profileUserId={profileData.id}
            isOwnProfile={isOwnProfile}
          />
        </div>
      </Card>

      {isOwnProfile && (
        <ProfileEditForm 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          username={profileData.username || ''}
          bio={bio}
          location={location}
          firstName={profileData.firstName || ''}
          lastName={profileData.lastName || ''}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </>
  );
};

export default ProfileCard;
