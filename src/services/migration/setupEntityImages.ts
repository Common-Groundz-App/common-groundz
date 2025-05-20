
import { supabase } from '@/integrations/supabase/client';
import { shouldDownloadImage } from '@/utils/imageUtils';
import { batchProcessEntityImages } from '@/services/mediaService';

/**
 * Verify access to the entity-images storage bucket
 * This assumes the bucket has been manually created in the Supabase dashboard
 */
export const setupEntityImagesBucket = async (): Promise<boolean> => {
  try {
    console.log('Verifying entity-images bucket access...');
    
    // First check if the user is authenticated - needed for some storage operations
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Authentication required: User must be logged in to verify bucket access');
      return false;
    }
    
    console.log('Authenticated as user:', user.id);
    
    // Test bucket existence by trying to list files (simplest permission test)
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('Error accessing storage buckets:', bucketError.message);
      console.error('Storage API error details:', bucketError);
      return false;
    }
    
    // Check if our specific bucket exists
    console.log('Available buckets:', buckets.map(b => b.name).join(', '));
    const bucketExists = buckets.some(bucket => bucket.name === 'entity-images');
    
    if (!bucketExists) {
      console.error('The entity-images bucket does not exist in your Supabase project.');
      console.error('Please create it manually in the Supabase dashboard with public access.');
      return false;
    }
    
    console.log('entity-images bucket found');
    
    // Test bucket access by trying to list files
    const { data: files, error: listError } = await supabase.storage
      .from('entity-images')
      .list('', {
        limit: 1,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
      
    if (listError) {
      console.error('Error accessing entity-images bucket:', listError.message);
      console.error('This may be a permissions issue with your bucket policies');
      console.error('Make sure public access is enabled and the bucket has appropriate RLS policies');
      return false;
    }
    
    console.log('Successfully verified entity-images bucket access, found', files?.length || 0, 'files');
    return true;
  } catch (error) {
    console.error('Unexpected error in setupEntityImagesBucket:', error);
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
    
    // First, make sure our bucket exists and is accessible
    const bucketSetup = await setupEntityImagesBucket();
    if (!bucketSetup) {
      console.error('Failed to verify storage bucket access, canceling migration');
      console.error('Please check that the entity-images bucket exists and has proper permissions');
      return results;
    }
    
    // Get all entities with image URLs that need to be downloaded
    const { data: entities, error } = await supabase
      .from('entities')
      .select('id, image_url, api_source, api_ref')
      .not('image_url', 'is', null)
      .eq('is_deleted', false);
      
    if (error) {
      console.error('Error fetching entities for migration:', error.message);
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
