
import { supabase } from '@/integrations/supabase/client';

export interface ImageDownloadResult {
  success: boolean;
  localUrl?: string;
  error?: string;
}

export const downloadAndStoreImage = async (
  imageUrl: string,
  entityId: string,
  filename?: string
): Promise<ImageDownloadResult> => {
  try {
    if (!imageUrl || imageUrl.startsWith('data:')) {
      return { success: false, error: 'Invalid image URL' };
    }

    // Generate filename if not provided
    const finalFilename = filename || `${entityId}-${Date.now()}.jpg`;
    const filePath = `entities/${entityId}/${finalFilename}`;

    console.log(`📸 Downloading image for entity ${entityId}:`, imageUrl);

    // Download image from external URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Convert blob to File
    const file = new File([blob], finalFilename, { type: blob.type });

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('entity-images')
      .upload(filePath, file, {
        upsert: true,
        contentType: blob.type
      });

    if (error) {
      console.error('❌ Storage upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('entity-images')
      .getPublicUrl(filePath);

    console.log(`✅ Image stored successfully:`, urlData.publicUrl);
    
    return {
      success: true,
      localUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('❌ Image download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const ensureEntityImagesBucket = async (): Promise<boolean> => {
  try {
    // Try to create bucket using edge function
    const { data, error } = await supabase.functions.invoke('ensure-bucket-policies', {
      body: { bucketName: 'entity-images' }
    });

    if (error) {
      console.warn('Could not ensure bucket policies via function:', error);
      // Try direct bucket creation as fallback
      const { error: bucketError } = await supabase.storage.createBucket('entity-images', {
        public: true,
        fileSizeLimit: 10485760,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (bucketError && !bucketError.message.includes('already exists')) {
        console.error('Bucket creation failed:', bucketError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error ensuring bucket:', error);
    return false;
  }
};
