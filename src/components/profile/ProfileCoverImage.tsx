
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileCoverImageProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange: (url: string) => void;
}

const ProfileCoverImage = ({ coverImage, isLoading, onCoverImageChange }: ProfileCoverImageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      setUploading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/cover.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
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
      
      // Update the cover_url in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_url: publicUrl }) // Store the URL without timestamp in the database
        .eq('id', user.id);
      
      if (updateError) {
        toast({
          title: 'Failed to update profile',
          description: updateError.message,
          variant: 'destructive'
        });
        return;
      }
      
      // Update local state via callback with a timestamp to force refresh
      onCoverImageChange(urlWithTimestamp);
      
      toast({
        title: 'Cover image updated',
        description: 'Your new cover image has been saved.',
      });
    } catch (error) {
      console.error('Error uploading cover image:', error);
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
    <div className="w-full relative">
      <div className="w-full h-[180px] sm:h-[200px] md:h-[250px] overflow-hidden relative">
        <div 
          className="w-full h-full"
          style={{ 
            backgroundImage: `url(${coverImage})`, 
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
          aria-label="Profile cover image"
        >
        </div>
        <label 
          htmlFor="cover-upload" 
          className="absolute bottom-4 right-4 bg-white/80 hover:bg-white backdrop-blur-sm px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors z-10"
        >
          {uploading || isLoading ? 'Uploading...' : 'Change Cover'}
        </label>
        <input 
          id="cover-upload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleCoverUpload}
          disabled={uploading || isLoading}
        />
      </div>
    </div>
  );
};

export default ProfileCoverImage;
