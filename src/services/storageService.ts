
import { supabase } from '@/integrations/supabase/client';

// Initialize storage service on application load
export const initializeStorageService = async (): Promise<void> => {
  try {
    // Check if user is authenticated before initializing
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Skip storage initialization for unauthenticated users
      return;
    }
    
    // Ensure required buckets exist and have proper policies
    await Promise.all([
      ensureBucketPolicies('entity-images'),
      ensureBucketPolicies('post_media'),
      ensureBucketPolicies('recommendation_images'),
      ensureBucketPolicies('enhanced-entity-data') // New bucket for enhanced data
    ]);

  } catch (error) {
    // Silently handle errors for unauthenticated users
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
      return false;
    }
    
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

/**
 * Store enhanced entity metadata as a backup
 */
export const storeEnhancedMetadata = async (
  entityId: string, 
  metadata: any
): Promise<boolean> => {
  try {
    const fileName = `${entityId}/enhanced-metadata.json`;
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { 
      type: 'application/json' 
    });
    
    const { error } = await supabase.storage
      .from('enhanced-entity-data')
      .upload(fileName, metadataBlob, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.error('Error storing enhanced metadata:', error);
      return false;
    }
    
    console.log(`Enhanced metadata stored for entity: ${entityId}`);
    return true;
  } catch (error) {
    console.error('Error in storeEnhancedMetadata:', error);
    return false;
  }
};

/**
 * Retrieve enhanced entity metadata backup
 */
export const retrieveEnhancedMetadata = async (entityId: string): Promise<any | null> => {
  try {
    const fileName = `${entityId}/enhanced-metadata.json`;
    
    const { data, error } = await supabase.storage
      .from('enhanced-entity-data')
      .download(fileName);
    
    if (error || !data) {
      console.log(`No enhanced metadata found for entity: ${entityId}`);
      return null;
    }
    
    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error retrieving enhanced metadata:', error);
    return null;
  }
};
