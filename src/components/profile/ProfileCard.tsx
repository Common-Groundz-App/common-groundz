
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Edit, Save } from 'lucide-react';
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
  profileImage: string;
  isLoading: boolean;
  onProfileImageChange: (url: string) => void;
}

const ProfileCard = ({ 
  username, 
  bio, 
  location, 
  memberSince, 
  followingCount, 
  profileImage,
  isLoading,
  onProfileImageChange
}: ProfileCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [currentBio, setCurrentBio] = useState(bio);
  const [uploading, setUploading] = useState(false);
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Update states when props change
  useEffect(() => {
    setCurrentUsername(username);
    setCurrentBio(bio);
  }, [username, bio]);

  // Check if there are changes to save
  useEffect(() => {
    setHasChanges(!!tempProfileImage);
  }, [tempProfileImage]);

  const handleSaveChanges = async () => {
    if (!user || !hasChanges) return;
    
    try {
      // Save the profile image URL to the database
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
        
        // Notify user of success
        toast({
          title: 'Profile saved',
          description: 'Your profile has been updated successfully.',
        });
        
        // Refresh the UserMenu component by triggering a global event
        window.dispatchEvent(new CustomEvent('profile-updated'));
        
        setHasChanges(false);
      }
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

  return (
    <>
      <Card className="relative md:w-[350px] bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="p-6 flex flex-col items-center">
          <ProfileAvatar 
            username={currentUsername}
            profileImage={profileImage}
            isLoading={isLoading}
            onProfileImageChange={onProfileImageChange}
            onImageSelected={setTempProfileImage}
          />
          
          <div className="flex items-center mb-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{currentUsername}</h2>
            {user && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="ml-2 text-gray-500 hover:text-brand-orange"
              >
                <Edit size={18} />
              </button>
            )}
          </div>
          <p className="text-gray-600 mb-4">{currentBio}</p>
          
          <ProfileActions 
            hasChanges={hasChanges}
            isLoading={isLoading}
            uploading={uploading}
            onSaveChanges={handleSaveChanges}
          />
          
          <ProfileInfo 
            location={location}
            memberSince={memberSince}
            followingCount={followingCount}
          />
        </div>
      </Card>

      <ProfileEditForm 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        username={currentUsername}
        bio={currentBio}
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
};

export default ProfileCard;
