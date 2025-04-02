
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Edit } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProfileEditForm from './ProfileEditForm';
import ProfileAvatar from './ProfileAvatar';
import ProfileActions from './ProfileActions';
import ProfileInfo from './ProfileInfo';

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
}

const ProfileCard = ({ 
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
  profileUserId
}: ProfileCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentBio, setCurrentBio] = useState(bio);
  const [uploading, setUploading] = useState(false);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [localHasChanges, setLocalHasChanges] = useState(false);
  const [databaseUsername, setDatabaseUsername] = useState<string>('');

  // Get the actual username from the database
  useEffect(() => {
    const fetchUsername = async () => {
      if (!profileUserId) return;

      try {
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
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchUsername();
  }, [profileUserId]);

  // Format username for display (use database username if available)
  const formattedUsername = databaseUsername 
    ? `@${databaseUsername}` 
    : '';

  // Update states when props change
  useEffect(() => {
    setCurrentUsername(username);
    setCurrentBio(bio);
  }, [username, bio]);

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

  const handleProfileUpdate = (newUsername: string, newBio: string) => {
    setCurrentUsername(newUsername);
    setCurrentBio(newBio);
  };

  // Combine local changes with Parent Component Changes
  const combinedHasChanges = hasChanges || localHasChanges;

  return (
    <>
      <Card className="relative bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 flex flex-col items-center">
          <ProfileAvatar 
            username={currentUsername}
            profileImage={profileImage}
            isLoading={isLoading}
            onProfileImageChange={onProfileImageChange}
            onImageSelected={setTempProfileImage}
            isEditable={isOwnProfile}
          />
          
          <div className="flex items-center mb-2">
            <h2 className="text-xl font-bold text-gray-900">{currentUsername}</h2>
            {isOwnProfile && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="ml-2 text-gray-500 hover:text-brand-orange"
              >
                <Edit size={18} />
              </button>
            )}
          </div>
          
          {/* Username display with @ symbol */}
          <div className="text-sm text-gray-500 mb-2">{formattedUsername}</div>
          
          <p className="text-gray-600 mb-4 text-sm text-center">{currentBio}</p>
          
          <ProfileActions 
            hasChanges={combinedHasChanges}
            isLoading={isLoading}
            uploading={uploading}
            onSaveChanges={handleSaveChanges}
            profileUserId={profileUserId}
            isOwnProfile={isOwnProfile}
          />
          
          <ProfileInfo 
            location={location}
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
          username={currentUsername}
          bio={currentBio}
          onProfileUpdate={handleProfileUpdate}
        />
      )}
    </>
  );
};

export default ProfileCard;
