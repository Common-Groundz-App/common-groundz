
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Calendar, Users, Edit } from 'lucide-react';
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

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
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
      
      // Update the avatar_url in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      
      if (updateError) {
        toast({
          title: 'Failed to update profile',
          description: updateError.message,
          variant: 'destructive'
        });
        return;
      }
      
      // Update local state via callback
      onProfileImageChange(publicUrl);
      
      toast({
        title: 'Profile image updated',
        description: 'Your new profile image has been saved.',
      });
    } catch (error) {
      console.error('Error uploading profile image:', error);
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
              />
            </div>
            <label 
              htmlFor="profile-upload" 
              className="absolute bottom-0 right-0 bg-white p-1 rounded-full shadow cursor-pointer"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-brand-orange text-white rounded-full">
                {isLoading ? '...' : '+'}
              </div>
            </label>
            <input 
              id="profile-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleProfileUpload}
              disabled={isLoading}
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
            <Button size={isMobile ? "sm" : "default"} className="bg-brand-orange hover:bg-brand-orange/90">Follow</Button>
            <Button size={isMobile ? "sm" : "default"} variant="outline">Message</Button>
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
