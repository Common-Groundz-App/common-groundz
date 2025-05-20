
import { supabase } from '@/integrations/supabase/client';
import { shouldDownloadImage } from '@/utils/imageUtils';
import { batchProcessEntityImages } from '@/services/mediaService';

/**
 * Verify access to the entity-images storage bucket
 * This assumes the bucket has been manually created in the Supabase dashboard
 * with proper RLS policies for authenticated users
 */
export const setupEntityImagesBucket = async (): Promise<boolean> => {
  try {
    console.log('Verifying entity-images bucket access...');
    
    // First check if the user is authenticated - needed for storage operations
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Authentication required: User must be logged in to verify bucket access');
      return false;
    }
    
    console.log('Authenticated as user:', user.id);
    
    // Simplified bucket verification - Just try a basic operation
    // This approach focuses on permissions rather than bucket existence
    try {
      // Just try to list a single file to test permissions
      const { data, error } = await supabase.storage
        .from('entity-images')
        .list('', { limit: 1 });
      
      if (error) {
        console.error('Error accessing entity-images bucket:', error.message);
        console.error('This is likely a permissions issue. Please check that RLS policies are properly set.');
        return false;
      }
      
      console.log('Successfully verified entity-images bucket access');
      return true;
    } catch (storageError) {
      console.error('Storage API error:', storageError);
      return false;
    }
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
      console.error('Please ensure you are logged in and that the entity-images bucket exists with proper permissions');
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
