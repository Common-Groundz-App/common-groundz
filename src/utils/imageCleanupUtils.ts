
import { supabase } from '@/integrations/supabase/client';

/**
 * Clean up and migrate images stored with temp-id
 */
export const cleanupTempIdImages = async (): Promise<{
  processed: number;
  migrated: number;
  deleted: number;
  errors: string[];
}> => {
  const results = {
    processed: 0,
    migrated: 0,
    deleted: 0,
    errors: [] as string[]
  };

  try {
    console.log('🧹 Starting temp-id image cleanup...');

    // List all files in the entity-images bucket
    const { data: files, error: listError } = await supabase.storage
      .from('entity-images')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      results.errors.push(`Failed to list files: ${listError.message}`);
      return results;
    }

    if (!files || files.length === 0) {
      console.log('No files found in entity-images bucket');
      return results;
    }

    // Find temp-id folders and orphaned files
    const tempIdFolders = files.filter(file => 
      file.name.startsWith('temp-') && file.metadata?.mimetype === undefined
    );

    console.log(`Found ${tempIdFolders.length} potential temp-id folders`);

    for (const folder of tempIdFolders) {
      try {
        results.processed++;
        
        // List files in this temp folder
        const { data: folderFiles, error: folderError } = await supabase.storage
          .from('entity-images')
          .list(folder.name, { limit: 100 });

        if (folderError || !folderFiles || folderFiles.length === 0) {
          console.log(`Skipping empty or invalid folder: ${folder.name}`);
          continue;
        }

        // Try to find a matching entity by checking recent entities
        const entityName = await tryMatchEntityByTimeAndMetadata(folder.name, folder.created_at);
        
        if (entityName) {
          // Migrate files to proper entity folder
          const migrated = await migrateFilesToEntity(folder.name, folderFiles, entityName);
          if (migrated) {
            results.migrated++;
            // Delete the temp folder after successful migration
            await deleteTempFolder(folder.name, folderFiles);
          }
        } else {
          // Delete orphaned temp folders older than 7 days
          const folderAge = new Date().getTime() - new Date(folder.created_at).getTime();
          const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
          
          if (folderAge > sevenDaysInMs) {
            console.log(`Deleting orphaned temp folder: ${folder.name}`);
            await deleteTempFolder(folder.name, folderFiles);
            results.deleted++;
          }
        }

      } catch (error) {
        console.error(`Error processing folder ${folder.name}:`, error);
        results.errors.push(`Folder ${folder.name}: ${error}`);
      }
    }

    console.log('🧹 Cleanup completed:', results);
    return results;

  } catch (error) {
    console.error('Error during cleanup:', error);
    results.errors.push(`General error: ${error}`);
    return results;
  }
};

/**
 * Try to match a temp folder to an actual entity
 */
async function tryMatchEntityByTimeAndMetadata(tempFolderId: string, createdAt: string): Promise<string | null> {
  try {
    // Look for entities created around the same time as the temp folder
    const timeWindow = new Date(createdAt);
    const startTime = new Date(timeWindow.getTime() - 5 * 60 * 1000); // 5 minutes before
    const endTime = new Date(timeWindow.getTime() + 5 * 60 * 1000); // 5 minutes after

    const { data: entities, error } = await supabase
      .from('entities')
      .select('id, name, created_at, image_url')
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString())
      .order('created_at', { ascending: false });

    if (error || !entities || entities.length === 0) {
      return null;
    }

    // Find entity with external image URL (indicating it might need migration)
    for (const entity of entities) {
      if (entity.image_url && 
          !entity.image_url.includes('entity-images') && 
          !entity.image_url.includes('storage.googleapis.com')) {
        return entity.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error matching entity:', error);
    return null;
  }
}

/**
 * Migrate files from temp folder to proper entity folder
 */
async function migrateFilesToEntity(tempFolderId: string, files: any[], entityId: string): Promise<boolean> {
  try {
    for (const file of files) {
      if (file.metadata?.mimetype?.startsWith('image/')) {
        const oldPath = `${tempFolderId}/${file.name}`;
        const newPath = `${entityId}/${file.name}`;

        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('entity-images')
          .download(oldPath);

        if (downloadError || !fileData) {
          console.error(`Failed to download ${oldPath}:`, downloadError);
          continue;
        }

        // Upload to new location
        const { error: uploadError } = await supabase.storage
          .from('entity-images')
          .upload(newPath, fileData, {
            contentType: file.metadata.mimetype,
            upsert: true
          });

        if (uploadError) {
          console.error(`Failed to upload ${newPath}:`, uploadError);
          continue;
        }

        // Update entity image URL
        const { data: { publicUrl } } = supabase.storage
          .from('entity-images')
          .getPublicUrl(newPath);

        await supabase
          .from('entities')
          .update({ image_url: publicUrl })
          .eq('id', entityId);

        console.log(`Migrated: ${oldPath} -> ${newPath}`);
      }
    }

    return true;
  } catch (error) {
    console.error('Error migrating files:', error);
    return false;
  }
}

/**
 * Delete temp folder and its contents
 */
async function deleteTempFolder(tempFolderId: string, files: any[]): Promise<void> {
  try {
    const filePaths = files.map(file => `${tempFolderId}/${file.name}`);
    
    if (filePaths.length > 0) {
      const { error } = await supabase.storage
        .from('entity-images')
        .remove(filePaths);

      if (error) {
        console.error(`Error deleting files from ${tempFolderId}:`, error);
      } else {
        console.log(`Deleted temp folder: ${tempFolderId}`);
      }
    }
  } catch (error) {
    console.error(`Error deleting temp folder ${tempFolderId}:`, error);
  }
}

/**
 * Get statistics about current image storage
 */
export const getImageStorageStats = async (): Promise<{
  totalFiles: number;
  tempIdFiles: number;
  properlyStoredFiles: number;
  totalSize: number;
}> => {
  const stats = {
    totalFiles: 0,
    tempIdFiles: 0,
    properlyStoredFiles: 0,
    totalSize: 0
  };

  try {
    const { data: files, error } = await supabase.storage
      .from('entity-images')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error || !files) {
      console.error('Error getting storage stats:', error);
      return stats;
    }

    for (const file of files) {
      if (file.metadata?.size) {
        stats.totalSize += file.metadata.size;
      }
      
      if (file.name.startsWith('temp-')) {
        stats.tempIdFiles++;
      } else {
        stats.properlyStoredFiles++;
      }
      
      stats.totalFiles++;
    }

    return stats;
  } catch (error) {
    console.error('Error calculating storage stats:', error);
    return stats;
  }
};
