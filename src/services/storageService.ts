import { supabase } from '@/integrations/supabase/client';

export const ensureBucketPolicies = async (bucketName: string): Promise<void> => {
  try {
    // This is a no-op function since bucket policies should be handled at the database level
    // We're keeping this for compatibility with existing code
    console.log(`Ensuring bucket policies for: ${bucketName}`);
  } catch (error) {
    console.error('Error ensuring bucket policies:', error);
  }
};

// Helper function to create storage buckets if they don't exist
export const ensureStorageBucket = async (bucketName: string, isPublic: boolean = true): Promise<void> => {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.id === bucketName);
    
    if (!bucketExists) {
      // Create bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: isPublic,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 5 * 1024 * 1024 // 5MB
      });
      
      if (createError) {
        console.error('Error creating bucket:', createError);
      } else {
        console.log(`Storage bucket '${bucketName}' created successfully`);
      }
    }
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
  }
};
