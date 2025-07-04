
import { supabase } from '@/integrations/supabase/client';
import { ensureBucketExists } from '@/utils/bucketUtils';

export interface EntityImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export const uploadEntityImage = async (
  file: File,
  userId: string
): Promise<EntityImageUploadResult> => {
  try {
    // Ensure the entity-images bucket exists
    const bucketExists = await ensureBucketExists('entity-images', true);
    if (!bucketExists) {
      return { success: false, error: 'Failed to initialize storage bucket' };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userId}/entities/entity_${timestamp}.${fileExtension}`;

    console.log('Uploading entity image:', fileName);

    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from('entity-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('entity-images')
      .getPublicUrl(fileName);

    console.log('Entity image uploaded successfully:', publicUrlData.publicUrl);

    return {
      success: true,
      url: publicUrlData.publicUrl
    };
  } catch (error) {
    console.error('Entity image upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
