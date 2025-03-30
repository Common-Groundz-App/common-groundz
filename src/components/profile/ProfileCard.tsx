
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Calendar, Users, Edit, Save } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import ProfileEditForm from './ProfileEditForm';

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
  const isMobile = useIsMobile();
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

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      setUploading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;
      
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
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      // Add a timestamp to force refresh
      const urlWithTimestamp = publicUrl + '?t=' + new Date().getTime();
      
      // Store the image URL in temporary state
      setTempProfileImage(publicUrl);
      
      // Just update the visual display for now
      onProfileImageChange(urlWithTimestamp);
      
      setHasChanges(true);
    } catch (error) {
      console.error('Error uploading profile image:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

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
          <div className="relative mb-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white">
              <img 
                src={profileImage} 
                alt="Profile" 
                className="w-full h-full object-cover"
                key={profileImage} // Add key to force re-render when image changes
              />
            </div>
            <label 
              htmlFor="profile-upload" 
              className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow cursor-pointer"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-brand-orange text-white rounded-full">
                {uploading || isLoading ? '...' : '+'}
              </div>
            </label>
            <input 
              id="profile-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleProfileUpload}
              disabled={uploading || isLoading}
            />
          </div>
          
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
          
          <div className="flex space-x-3 mb-6">
            {hasChanges ? (
              <Button 
                size={isMobile ? "sm" : "default"} 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSaveChanges}
                disabled={!hasChanges || isLoading || uploading}
              >
                <Save size={16} className="mr-1" /> Save Changes
              </Button>
            ) : (
              <>
                <Button size={isMobile ? "sm" : "default"} className="bg-brand-orange hover:bg-brand-orange/90">Follow</Button>
                <Button size={isMobile ? "sm" : "default"} variant="outline">Message</Button>
              </>
            )}
          </div>
          
          <div className="w-full space-y-3 text-left">
            <div className="flex items-center text-gray-700">
              <MapPin className="w-5 h-5 mr-2" />
              <span>{location}</span>
            </div>
            
            <div className="flex items-center text-gray-700">
              <Calendar className="w-5 h-5 mr-2" />
              <span>Member since {memberSince}</span>
            </div>
            
            <div className="flex items-center text-gray-700">
              <Users className="w-5 h-5 mr-2" />
              <span>{followingCount} following</span>
            </div>
          </div>
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
