
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useProfile, useProfileCacheActions } from '@/hooks/use-profile-cache';
import { ProfileAvatar as CommonProfileAvatar } from '@/components/common/ProfileAvatar';
import { AvatarCropModal } from './AvatarCropModal';
import { fileToDataUrl } from '@/utils/imageProcessing';

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
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  const { data: profile } = useProfile(userId || user?.id);
  const { invalidateProfile } = useProfileCacheActions();
  
  console.log("ProfileAvatar rendering with profileImage:", propProfileImage);

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      console.log("File selected:", file.name, file.size, file.type);
      
      // Convert file to data URL for cropping
      const imageSrc = await fileToDataUrl(file);
      setSelectedImageSrc(imageSrc);
      setIsCropModalOpen(true);
      console.log("Image cropping modal opened");
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to read the selected image',
        variant: 'destructive'
      });
    }
    
    // Reset file input
    e.target.value = '';
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    if (!user) return;
    
    try {
      setUploading(true);
      console.log("Starting avatar upload process for user:", user.id);
      
      // Create unique filename with timestamp to avoid caching issues
      const timestamp = Date.now();
      const fileExt = 'jpg'; // Always use jpg for cropped images
      const filePath = `${user.id}/avatar-${timestamp}.${fileExt}`;
      
      console.log("Uploading to path:", filePath);
      
      // Upload the cropped image to Supabase Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profile_images')
        .upload(filePath, croppedImageBlob, { upsert: true });
      
      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive'
        });
        return;
      }
      
      console.log("Upload successful:", uploadData);
      
      // Get the public URL (without timestamp for database storage)
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      console.log("Generated public URL:", publicUrl);
      
      // Immediately save to database
      console.log("Updating database with new avatar URL...");
      const { error: updateError, data: updateData } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select();
      
      if (updateError) {
        console.error("Database update error:", updateError);
        toast({
          title: 'Failed to update profile',
          description: updateError.message,
          variant: 'destructive'
        });
        return;
      }
      
      console.log("Database updated successfully:", updateData);
      
      // Invalidate profile cache to trigger re-renders everywhere
      console.log("Invalidating profile cache for user:", user.id);
      invalidateProfile(user.id);
      
      // Also trigger a global profile update event for other components
      window.dispatchEvent(new CustomEvent('profile-updated'));
      
      // Close the crop modal
      setIsCropModalOpen(false);
      setSelectedImageSrc('');
      
      console.log("Avatar update process completed successfully");
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully',
      });
      
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

  const handleCropCancel = () => {
    setIsCropModalOpen(false);
    setSelectedImageSrc('');
    console.log("Avatar crop cancelled");
  };

  return (
    <>
      <div className="relative mb-4">
        <div className="relative">
          <CommonProfileAvatar 
            userId={userId || user?.id}
            size="xl"
            className="w-24 h-24 md:w-32 md:h-32 border-4 border-white"
          />
          
          {isEditable && (
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
                onChange={handleFileSelection}
                disabled={uploading || isLoading}
              />
            </>
          )}
        </div>
      </div>

      <AvatarCropModal
        isOpen={isCropModalOpen}
        onClose={handleCropCancel}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCropComplete}
        isProcessing={uploading}
      />
    </>
  );
};

export default ProfileAvatar;
