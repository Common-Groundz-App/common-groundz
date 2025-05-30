
import React, { useRef, useState, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface ProfileCoverImageProps {
  coverImage: string;
  isLoading: boolean;
  onCoverImageChange?: (url: string) => void;
  onCoverImageUpdated?: (url: string | null) => void;
  isEditable?: boolean;
}

// Using memo to prevent unnecessary re-renders
const ProfileCoverImage = memo(({ 
  coverImage, 
  isLoading,
  onCoverImageChange,
  onCoverImageUpdated,
  isEditable = true
}: ProfileCoverImageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showRemoveButton, setShowRemoveButton] = useState(false);
  
  console.log("ProfileCoverImage rendering with coverImage:", coverImage);
  
  const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';

  const handleCoverImageClick = () => {
    if (isEditable && onCoverImageChange && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !onCoverImageChange) return;
    
    try {
      setUploading(true);
      
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
          variant: 'destructive'
        });
        return;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);
      
      // Add a timestamp to force refresh
      const urlWithTimestamp = publicUrl + '?t=' + Date.now();
      
      console.log("New cover image URL:", urlWithTimestamp);
      
      // Update the visual display
      onCoverImageChange(urlWithTimestamp);
      
      // Store the image URL to be saved later
      if (onCoverImageUpdated) {
        onCoverImageUpdated(publicUrl);
      }
      
      toast({
        title: 'Cover image uploaded',
        description: 'Remember to save your changes.',
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

  const handleRemoveCoverImage = () => {
    if (!onCoverImageChange || !onCoverImageUpdated) return;
    
    // Default cover image
    const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';
    
    // Update the visual display
    onCoverImageChange(defaultCoverImage);
    
    // Store null to indicate that the cover image should be removed
    onCoverImageUpdated(null);
    
    setShowRemoveButton(false);
    
    toast({
      title: 'Cover image removed',
      description: 'Remember to save your changes.',
    });
  };

  return (
    <div 
      className="w-full h-48 md:h-64 relative group z-0"
      onMouseEnter={() => setShowRemoveButton(true)}
      onMouseLeave={() => setShowRemoveButton(false)}
    >
      <div className="absolute inset-0 overflow-hidden">
        <ImageWithFallback
          src={coverImage}
          fallbackSrc={defaultCoverImage}
          alt="Cover Image"
          className="w-full h-full object-cover"
          onError={(e) => console.error("Cover image failed to load:", coverImage)}
        />
      </div>
      
      {isEditable && onCoverImageChange && (
        <>
          <div 
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center cursor-pointer"
            onClick={handleCoverImageClick}
          >
            {!uploading && !isLoading && (
              <div className="bg-black bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300">
                <Camera size={24} />
              </div>
            )}
            {(uploading || isLoading) && (
              <div className="bg-black bg-opacity-70 text-white p-3 rounded-lg">
                Loading...
              </div>
            )}
          </div>
          
          <input 
            ref={fileInputRef}
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleCoverImageChange}
            disabled={uploading || isLoading}
          />
          
          {coverImage && coverImage !== defaultCoverImage && showRemoveButton && !uploading && !isLoading && (
            <button 
              className="absolute top-4 right-4 bg-black bg-opacity-70 text-white p-2 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveCoverImage();
              }}
            >
              <X size={16} />
            </button>
          )}
        </>
      )}
    </div>
  );
});

ProfileCoverImage.displayName = 'ProfileCoverImage';

export default ProfileCoverImage;
