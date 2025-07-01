import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useProfile, useProfileCacheActions } from '@/hooks/use-profile-cache';
import { ProfileAvatar as CommonProfileAvatar } from '@/components/common/ProfileAvatar';

interface ProfileAvatarProps {
  userId?: string | null;
  username?: string;
  profileImage?: string;
  isLoading?: boolean;
  onProfileImageChange?: (url: string) => void;
  onImageSelected?: (url: string | null) => void;
  isEditable?: boolean;
}

const ProfileAvatar = ({ 
  userId,
  username: propUsername, 
  profileImage: propProfileImage, 
  isLoading = false, 
  onProfileImageChange,
  onImageSelected,
  isEditable = true
}: ProfileAvatarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { data: profile } = useProfile(userId || user?.id);
  const { updateProfileCache } = useProfileCacheActions();
  
  console.log("ProfileAvatar rendering with profileImage:", propProfileImage);

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !onProfileImageChange) return;
    
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
      
      console.log("New profile image URL:", urlWithTimestamp);
      
      // Store the image URL in temporary state
      if (onImageSelected) {
        onImageSelected(publicUrl);
      }
      
      // Update the visual display
      onProfileImageChange(urlWithTimestamp);
      
      // Update the profile cache
      if (profile) {
        updateProfileCache(user.id, {
          ...profile,
          avatar_url: publicUrl
        });
      }
      
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

  return (
    <div className="relative mb-4">
      <div className="relative">
        <CommonProfileAvatar 
          userId={userId || user?.id}
          size="xl"
          className="w-24 h-24 md:w-32 md:h-32 border-4 border-white"
        />
        
        {isEditable && onProfileImageChange && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileAvatar;
