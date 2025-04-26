
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileCoverImageProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange: (url: string) => void;
  onCoverImageUpdated: (url: string | null) => void;
  isOwnProfile: boolean;
}

const ProfileCoverImage = ({ 
  coverImage, 
  isLoading, 
  onCoverImageChange, 
  onCoverImageUpdated,
  isOwnProfile
}: ProfileCoverImageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !isOwnProfile) return;
    
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/cover.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile_images')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive',
        });
        return;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      // Add timestamp to force browser to reload the image
      const urlWithTimestamp = publicUrl + '?t=' + new Date().getTime();
      
      // Update UI with new image
      onCoverImageChange(urlWithTimestamp);
      
      // Store the new URL for saving later
      onCoverImageUpdated(publicUrl);
      
      toast({
        title: 'Cover image uploaded',
        description: 'Don\'t forget to save your changes',
      });
      
    } catch (error) {
      console.error('Error uploading cover image:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full h-64 md:h-80 bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
      {/* Cover Image */}
      <img 
        src={coverImage} 
        alt="Cover"
        className="w-full h-full object-cover"
      />
      
      {/* Upload Button (Only for own profile) */}
      {isOwnProfile && !isLoading && (
        <div className="absolute bottom-4 right-4">
          <label 
            htmlFor="cover-image-upload"
            className="flex items-center justify-center h-10 px-4 bg-brand-orange text-white rounded-md shadow-md cursor-pointer hover:bg-brand-orange/90 transition-all font-medium"
          >
            {isUploading ? 'Uploading...' : 'Change Cover'}
          </label>
          <input
            id="cover-image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverImageUpload}
            disabled={isUploading}
          />
        </div>
      )}
    </div>
  );
};

export default ProfileCoverImage;
