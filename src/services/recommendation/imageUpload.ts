
import { supabase } from '@/integrations/supabase/client';

// Image upload helper function
export const uploadRecommendationImage = async (userId: string, file: File) => {
  // Create path with user ID for better organization
  const path = `${userId}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('recommendation_images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }

  // Get public URL for the uploaded image
  const { data: { publicUrl } } = supabase.storage
    .from('recommendation_images')
    .getPublicUrl(data.path);

  return publicUrl;
};
