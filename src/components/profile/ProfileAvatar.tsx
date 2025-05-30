
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { useProfile, useProfileCacheActions } from '@/hooks/use-profile-cache';

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
  
  // Use cached profile data with prop fallbacks
  const username = propUsername || profile?.displayName || profile?.username || 'User';
  const profileImage = propProfileImage || profile?.avatar_url || '';
  
  console.log("ProfileAvatar rendering with profileImage:", profileImage);

  // Get initials from username
  const getInitials = () => {
    if (!username) return 'U';
    
    const words = username.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

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

  // Determine if we should show the initials placeholder
  const showInitials = !profileImage || profileImage.trim() === '';

  return (
    <div className="relative mb-4">
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white">
        {showInitials ? (
          <div className="w-full h-full flex items-center justify-center bg-brand-orange text-white text-2xl md:text-3xl font-bold">
            {getInitials()}
          </div>
        ) : (
          <ImageWithFallback 
            src={profileImage} 
            alt={`${username}'s profile`}
            className="w-full h-full object-cover"
            onError={(e) => console.error("Profile image failed to load:", profileImage)}
            fallbackSrc=""
          />
        )}
      </div>
      
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
  );
};

export default ProfileAvatar;
