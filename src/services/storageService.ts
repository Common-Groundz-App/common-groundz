
import { supabase } from '@/integrations/supabase/client';

// Initialize storage service on application load
export const initializeStorageService = async (): Promise<void> => {
  try {
    console.log('Initializing storage service...');
    
    // Ensure required buckets exist and have proper policies
    await Promise.all([
      ensureBucketPolicies('entity-images'),
      ensureBucketPolicies('post_media'),
      ensureBucketPolicies('recommendation_images')
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
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn(`No active session found for bucket policy setup. Bucket: ${bucketName}`);
      return false;
    }
    
    console.log(`Ensuring bucket policies for: ${bucketName}`);
    
    const { data, error } = await supabase.functions.invoke('ensure-bucket-policies', {
      body: { bucketName }
    });
    
    if (error) {
      console.error(`Error ensuring bucket policies for ${bucketName}:`, error);
      return false;
    }
    
    console.log(`Successfully ensured policies for bucket ${bucketName}:`, data);
    return data?.success || false;
  } catch (error) {
    console.error(`Error calling ensure-bucket-policies function:`, error);
    return false;
  }
};

/**
 * Ensure that a storage bucket exists, creates it if it doesn't
 * 
 * @param bucketName The name of the bucket
 * @param publicAccess Whether the bucket should be public (default: true)
 * @returns boolean indicating if the bucket exists or was created successfully
 */
export const ensureBucketExists = async (
  bucketName: string, 
  publicAccess: boolean = true
): Promise<boolean> => {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`Error listing buckets: ${listError.message}`);
      return false;
    }
    
    // Check if our bucket exists
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    // If bucket doesn't exist, create it
    if (!bucketExists) {
      console.log(`Bucket ${bucketName} doesn't exist, creating it...`);
      
      // Create the bucket with public access
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: publicAccess,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}: ${createError.message}`);
        return false;
      }
      
      console.log(`Successfully created bucket: ${bucketName}`);
      return true;
    }
    
    console.log(`Bucket ${bucketName} already exists`);
    return true;
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
};

/**
 * Updates bucket public access status
 * 
 * @param bucketName The name of the bucket
 * @param publicAccess Whether the bucket should be public
 * @returns boolean indicating if the operation was successful
 */
export const updateBucketPublicAccess = async (
  bucketName: string,
  publicAccess: boolean
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage.updateBucket(bucketName, {
      public: publicAccess
    });
    
    if (error) {
      console.error(`Error updating bucket ${bucketName}: ${error.message}`);
      return false;
    }
    
    console.log(`Successfully updated bucket ${bucketName} (public: ${publicAccess})`);
    return true;
  } catch (error) {
    console.error('Error updating bucket:', error);
    return false;
  }
};
