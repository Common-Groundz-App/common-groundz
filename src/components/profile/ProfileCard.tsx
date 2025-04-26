import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import ProfileAvatar from './ProfileAvatar';
import ProfileActions from './ProfileActions';
import ProfileInfo from './ProfileInfo';
import ProfileUserInfo from './ProfileUserInfo';
import ProfileBadges from './ProfileBadges';
import { useViewedProfile } from '@/hooks/profile/use-viewed-profile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileCardProps {
  profileUserId?: string;
}

const ProfileCard = ({ profileUserId }: ProfileCardProps) => {
  const {
    profile,
    isLoading,
    error,
    isOwnProfile,
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount
  } = useViewedProfile(profileUserId);

  const [hasChanges, setHasChanges] = useState(false);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleProfileImageChange = (url: string) => {
    setTempProfileImage(url);
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!user || !profile) return;

    try {
      setUploading(true);

      // If there's a temporary profile image, upload it and get the URL
      let avatar_url = profile.avatar_url;
      if (tempProfileImage) {
        const fileExt = tempProfileImage.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;
        const file = await fetch(tempProfileImage).then(r => r.blob());

        const { error: uploadError } = await supabase.storage
          .from('profile_images')
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          toast({
            title: 'Upload failed',
            description: uploadError.message,
            variant: 'destructive'
          });
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('profile_images')
          .getPublicUrl(filePath);

        avatar_url = publicUrl;
      }

      // Update the profile in the database
      const updates = {
        id: user.id,
        username: profile.username,
        bio: profile.bio,
        location: profile.location,
        avatar_url,
        updated_at: new Date(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updates, { returning: 'minimal' });

      if (updateError) {
        throw updateError;
      }

      // Update user metadata if necessary
      const metadataUpdates: { [key: string]: any } = {};
      if (user.user_metadata.first_name !== profile.displayName.split(' ')[0]) {
        metadataUpdates.first_name = profile.displayName.split(' ')[0];
      }
      if (user.user_metadata.last_name !== profile.displayName.split(' ')[1]) {
        metadataUpdates.last_name = profile.displayName.split(' ')[1];
      }

      if (Object.keys(metadataUpdates).length > 0) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: metadataUpdates
        });

        if (metadataError) {
          throw metadataError;
        }
      }

      toast({
        title: 'Profile updated!',
        description: 'Your profile has been updated successfully.',
      });
      setHasChanges(false);
      setTempProfileImage(null);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast({
        title: 'Something went wrong',
        description: err.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  if (error) {
    return (
      <Card className="relative shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 text-center text-red-500">
          Failed to load profile data
        </div>
      </Card>
    );
  }

  if (!profile || isLoading) {
    return (
      <Card className="relative shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 animate-pulse">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gray-200 mb-4" />
            <div className="h-6 w-32 bg-gray-200 mb-2" />
            <div className="h-4 w-24 bg-gray-200 mb-4" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative shadow-lg rounded-lg overflow-hidden">
      <div className="p-6 flex flex-col items-center">
        <ProfileAvatar 
          username={profile.displayName}
          profileImage={tempProfileImage || profile.avatar_url || ''}
          isLoading={isLoading}
          onProfileImageChange={isOwnProfile ? handleProfileImageChange : undefined}
          onImageSelected={setTempProfileImage}
          isEditable={isOwnProfile}
        />

        <ProfileUserInfo 
          username={profile.displayName}
          bio={profile.bio || ''}
          isOwnProfile={isOwnProfile}
          formattedUsername={profile.username ? `@${profile.username}` : ''}
          onEditClick={isOwnProfile ? () => {} : undefined}
          isVerified={false}
        />

        <ProfileBadges isOwnProfile={isOwnProfile} />

        <ProfileActions 
          hasChanges={hasChanges}
          isLoading={isLoading}
          uploading={uploading}
          onSaveChanges={handleSaveChanges}
          profileUserId={profileUserId}
          isOwnProfile={isOwnProfile}
        />

        <ProfileInfo 
          location={profile.location || ''}
          memberSince={profile.created_at}
          followingCount={followingCount}
          followerCount={followerCount}
          profileUserId={profileUserId}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </Card>
  );
};

export default ProfileCard;
