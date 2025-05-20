
import { supabase } from '@/integrations/supabase/client';
import { ensureBucketExists, updateBucketPublicAccess } from '@/utils/bucketUtils';

// Initialize storage service on application load
export const initializeStorageService = async (): Promise<void> => {
  try {
    // Ensure required buckets exist
    await Promise.all([
      ensureBucketExists('entity-images', true),
      ensureBucketExists('post_media', true),
      ensureBucketExists('recommendation_images', true)
    ]);

    console.log('Storage service initialized successfully');
  } catch (error) {
    console.error('Error initializing storage service:', error);
  }
};

/**
 * Create appropriate RLS policies for a bucket if they don't exist
 * This can only be done by a service role account, so we use an edge function
 * 
 * @param bucketName The name of the bucket
 * @returns boolean indicating success
 */
export const ensureBucketPolicies = async (bucketName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('ensure-bucket-policies', {
      body: { bucketName }
    });
    
    if (error) {
      console.error(`Error ensuring bucket policies for ${bucketName}:`, error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error(`Error calling ensure-bucket-policies function:`, error);
    return false;
  }
};

// Export other functions from bucketUtils for convenience
export { ensureBucketExists, updateBucketPublicAccess };

