
import { supabase } from '@/integrations/supabase/client';
import { shouldDownloadImage } from '@/utils/imageUtils';
import { batchProcessEntityImages } from '@/services/mediaService';

/**
 * Create the entity-images storage bucket if it doesn't exist
 */
export const setupEntityImagesBucket = async (): Promise<boolean> => {
  try {
    // Check if the bucket already exists
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error checking storage buckets:', error);
      return false;
    }
    
    // Find if our bucket already exists
    const bucketExists = buckets.some(bucket => bucket.name === 'entity-images');
    
    if (!bucketExists) {
      console.log('Creating entity-images bucket...');
      
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket(
        'entity-images',
        {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        }
      );
      
      if (createError) {
        console.error('Error creating entity-images bucket:', createError);
        return false;
      }
      
      console.log('entity-images bucket created successfully');
    } else {
      console.log('entity-images bucket already exists');
    }
    
    return true;
  } catch (error) {
    console.error('Error in setupEntityImagesBucket:', error);
    return false;
  }
};

/**
 * Migrate existing entity images from external sources to our storage
 */
export const migrateExistingEntityImages = async (): Promise<{
  total: number;
  processed: number;
  successful: number;
}> => {
  const results = {
    total: 0,
    processed: 0,
    successful: 0
  };
  
  try {
    console.log('Starting migration of existing entity images...');
    
    // First, make sure our bucket exists
    const bucketSetup = await setupEntityImagesBucket();
    if (!bucketSetup) {
      console.error('Failed to set up storage bucket, canceling migration');
      return results;
    }
    
    // Get all entities with image URLs that need to be downloaded
    const { data: entities, error } = await supabase
      .from('entities')
      .select('id, image_url, api_source, api_ref')
      .not('image_url', 'is', null)
      .eq('is_deleted', false);
      
    if (error) {
      console.error('Error fetching entities for migration:', error);
      return results;
    }
    
    results.total = entities.length;
    console.log(`Found ${entities.length} entities with images`);
    
    // Filter to only those that need downloading
    const entitiesToProcess = entities.filter(entity => 
      shouldDownloadImage(entity.image_url, entity.api_source)
    );
    
    results.processed = entitiesToProcess.length;
    console.log(`${entitiesToProcess.length} entities need image migration`);
    
    if (entitiesToProcess.length === 0) {
      console.log('No entity images need migration');
      return results;
    }
    
    // Process the entities in batches
    const updatedUrls = await batchProcessEntityImages(entitiesToProcess);
    
    // Count successful downloads
    results.successful = Object.values(updatedUrls).filter(url => !!url).length;
    
    console.log(`Migration completed: ${results.successful}/${results.processed} images migrated successfully`);
    return results;
    
  } catch (error) {
    console.error('Error in migrateExistingEntityImages:', error);
    return results;
  }
};
