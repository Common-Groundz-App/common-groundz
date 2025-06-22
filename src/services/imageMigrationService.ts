
import { supabase } from '@/integrations/supabase/client';
import { saveExternalImageToStorage } from '@/utils/imageUtils';
import { imagePerformanceService } from './imagePerformanceService';

interface MigrationResult {
  entityId: string;
  entityName: string;
  originalUrl: string;
  newUrl: string | null;
  success: boolean;
  error?: string;
}

interface MigrationStats {
  totalEntities: number;
  migrated: number;
  failed: number;
  skipped: number;
  alreadyProcessed: number;
  results: MigrationResult[];
}

interface MigrationSession {
  id: string;
  total_entities: number;
  migrated_count: number;
  failed_count: number;
  skipped_count: number;
  already_processed_count: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
}

class ImageMigrationService {
  private readonly BATCH_SIZE = 10; // Process in smaller batches to avoid timeouts
  private readonly DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

  /**
   * Checks if a URL is a proxy URL that shouldn't be migrated
   */
  private isProxyUrl(url: string): boolean {
    return url.includes('supabase.co/functions/v1/proxy-') || 
           url.includes('/functions/v1/proxy-') ||
           url.includes('entity-images') ||
           url.includes('storage.googleapis.com');
  }

  /**
   * Gets entities with external images that need migration
   */
  async getEntitiesNeedingMigration(): Promise<Array<{ id: string; name: string; image_url: string }>> {
    try {
      const { data: entities, error } = await supabase
        .from('entities')
        .select('id, name, image_url')
        .eq('is_deleted', false)
        .not('image_url', 'is', null);
      
      if (error) {
        console.error('[ImageMigration] Error fetching entities for migration:', error);
        return [];
      }
      
      // Filter out entities that already have proxy URLs or stored images
      const filteredEntities = (entities || []).filter(entity => {
        return !this.isProxyUrl(entity.image_url);
      });

      console.log(`[ImageMigration] Found ${entities?.length || 0} total entities, ${filteredEntities.length} need migration`);
      
      return filteredEntities;
    } catch (error) {
      console.error('[ImageMigration] Error in getEntitiesNeedingMigration:', error);
      return [];
    }
  }

  /**
   * Creates a new migration session
   */
  async createMigrationSession(totalEntities: number): Promise<string | null> {
    try {
      const response = await supabase
        .from('image_migration_sessions')
        .insert({
          total_entities: totalEntities,
          migrated_count: 0,
          failed_count: 0,
          skipped_count: 0,
          already_processed_count: 0,
          started_at: new Date().toISOString(),
          status: 'running'
        })
        .select('id')
        .single();

      if (response.error || !response.data) {
        console.error('[ImageMigration] Error creating migration session:', response.error);
        return null;
      }

      return response.data.id;
    } catch (error) {
      console.error('[ImageMigration] Error in createMigrationSession:', error);
      return null;
    }
  }

  /**
   * Updates migration session with progress
   */
  async updateMigrationSession(sessionId: string, stats: {
    migrated: number;
    failed: number;
    skipped: number;
    alreadyProcessed: number;
    status?: 'running' | 'completed' | 'failed';
  }): Promise<void> {
    try {
      const updateData: any = {
        migrated_count: stats.migrated,
        failed_count: stats.failed,
        skipped_count: stats.skipped,
        already_processed_count: stats.alreadyProcessed
      };

      if (stats.status) {
        updateData.status = stats.status;
        if (stats.status === 'completed' || stats.status === 'failed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('image_migration_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) {
        console.error('[ImageMigration] Error updating migration session:', error);
      }
    } catch (error) {
      console.error('[ImageMigration] Error in updateMigrationSession:', error);
    }
  }

  /**
   * Saves migration result to database
   */
  async saveMigrationResult(sessionId: string, result: MigrationResult): Promise<void> {
    try {
      const { error } = await supabase
        .from('image_migration_results')
        .insert({
          session_id: sessionId,
          entity_id: result.entityId,
          entity_name: result.entityName,
          original_url: result.originalUrl,
          new_url: result.newUrl,
          success: result.success,
          error_message: result.error || null,
          migrated_at: new Date().toISOString()
        });

      if (error) {
        console.error('[ImageMigration] Error saving migration result:', error);
      }
    } catch (error) {
      console.error('[ImageMigration] Error in saveMigrationResult:', error);
    }
  }

  /**
   * Migrates a single entity's image
   */
  async migrateEntityImage(entity: { id: string; name: string; image_url: string }): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[ImageMigration] Processing entity "${entity.name}": ${entity.image_url}`);
      
      // Check if image is already a proxy URL or stored image
      if (this.isProxyUrl(entity.image_url)) {
        console.log(`[ImageMigration] Entity "${entity.name}" already has processed URL, skipping`);
        return {
          entityId: entity.id,
          entityName: entity.name,
          originalUrl: entity.image_url,
          newUrl: entity.image_url,
          success: true,
          error: 'Already processed (proxy/stored URL)'
        };
      }

      // Migrate the image to storage
      const newImageUrl = await saveExternalImageToStorage(entity.image_url, entity.id);
      
      if (!newImageUrl || newImageUrl === entity.image_url) {
        // Migration failed, but we don't throw error to continue with other entities
        imagePerformanceService.trackImageStorage(
          'migration_failed',
          entity.id,
          entity.image_url,
          startTime,
          false,
          'Migration returned original URL'
        );
        
        return {
          entityId: entity.id,
          entityName: entity.name,
          originalUrl: entity.image_url,
          newUrl: null,
          success: false,
          error: 'Migration failed - returned original URL'
        };
      }

      // Update entity with new image URL
      const { error: updateError } = await supabase
        .from('entities')
        .update({ 
          image_url: newImageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity.id);
        
      if (updateError) {
        console.error(`[ImageMigration] Error updating entity ${entity.id}:`, updateError);
        return {
          entityId: entity.id,
          entityName: entity.name,
          originalUrl: entity.image_url,
          newUrl: newImageUrl,
          success: false,
          error: `Database update failed: ${updateError.message}`
        };
      }

      imagePerformanceService.trackImageStorage(
        'migration_success',
        entity.id,
        newImageUrl,
        startTime,
        true,
        undefined,
        {
          originalUrl: entity.image_url,
          entityName: entity.name
        }
      );

      console.log(`[ImageMigration] Successfully migrated image for "${entity.name}"`);
      
      return {
        entityId: entity.id,
        entityName: entity.name,
        originalUrl: entity.image_url,
        newUrl: newImageUrl,
        success: true
      };
      
    } catch (error: any) {
      console.error(`[ImageMigration] Error migrating entity ${entity.id}:`, error);
      
      imagePerformanceService.trackImageStorage(
        'migration_failed',
        entity.id,
        entity.image_url,
        startTime,
        false,
        error.message
      );
      
      return {
        entityId: entity.id,
        entityName: entity.name,
        originalUrl: entity.image_url,
        newUrl: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Runs automated migration for all external images
   */
  async runAutomatedMigration(): Promise<MigrationStats> {
    console.log('[ImageMigration] Starting automated image migration');
    
    const entities = await this.getEntitiesNeedingMigration();
    
    if (entities.length === 0) {
      console.log('[ImageMigration] No entities found for migration');
      return {
        totalEntities: 0,
        migrated: 0,
        failed: 0,
        skipped: 0,
        alreadyProcessed: 0,
        results: []
      };
    }

    console.log(`[ImageMigration] Found ${entities.length} entities for migration`);
    
    // Create migration session
    const sessionId = await this.createMigrationSession(entities.length);
    if (!sessionId) {
      throw new Error('Failed to create migration session');
    }

    const results: MigrationResult[] = [];
    let migrated = 0;
    let failed = 0;
    let skipped = 0;
    let alreadyProcessed = 0;

    // Process entities in batches
    for (let i = 0; i < entities.length; i += this.BATCH_SIZE) {
      const batch = entities.slice(i, i + this.BATCH_SIZE);
      console.log(`[ImageMigration] Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(entities.length / this.BATCH_SIZE)}`);
      
      // Process batch in parallel
      const batchPromises = batch.map(entity => this.migrateEntityImage(entity));
      const batchResults = await Promise.all(batchPromises);
      
      // Save results and update counters
      for (const result of batchResults) {
        results.push(result);
        
        if (result.success) {
          if (result.error === 'Already processed (proxy/stored URL)') {
            alreadyProcessed++;
          } else {
            migrated++;
          }
        } else {
          failed++;
        }
        
        // Save result to database
        if (sessionId) {
          await this.saveMigrationResult(sessionId, result);
        }
      }
      
      // Update session progress
      await this.updateMigrationSession(sessionId, {
        migrated,
        failed,
        skipped,
        alreadyProcessed,
        status: 'running'
      });
      
      // Delay between batches to avoid overwhelming external servers
      if (i + this.BATCH_SIZE < entities.length) {
        console.log(`[ImageMigration] Waiting ${this.DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
      }
    }

    // Mark session as completed
    await this.updateMigrationSession(sessionId, {
      migrated,
      failed,
      skipped,
      alreadyProcessed,
      status: 'completed'
    });

    const stats: MigrationStats = {
      totalEntities: entities.length,
      migrated,
      failed,
      skipped,
      alreadyProcessed,
      results
    };

    console.log(`[ImageMigration] Migration completed: ${migrated} migrated, ${failed} failed, ${skipped} skipped, ${alreadyProcessed} already processed`);
    
    return stats;
  }

  /**
   * Gets latest migration session
   */
  async getLatestMigrationSession(): Promise<MigrationSession | null> {
    try {
      const response = await supabase
        .from('image_migration_sessions')
        .select('id, total_entities, migrated_count, failed_count, skipped_count, already_processed_count, started_at, completed_at, status')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (response.error) {
        console.error('[ImageMigration] Error fetching latest migration session:', response.error);
        return null;
      }

      if (!response.data) {
        return null;
      }

      const sessionData = response.data;
      
      // Validate that the data has the expected structure
      if (!sessionData.id || typeof sessionData.total_entities !== 'number') {
        console.error('[ImageMigration] Invalid migration session data structure');
        return null;
      }

      return sessionData as MigrationSession;
    } catch (error) {
      console.error('[ImageMigration] Error in getLatestMigrationSession:', error);
      return null;
    }
  }

  /**
   * Gets migration results for a session
   */
  async getSessionMigrationResults(sessionId: string): Promise<MigrationResult[]> {
    try {
      const { data, error } = await supabase
        .from('image_migration_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('migrated_at', { ascending: false });

      if (error) {
        console.error('[ImageMigration] Error fetching migration results:', error);
        return [];
      }

      return (data || []).map((result: any) => ({
        entityId: result.entity_id,
        entityName: result.entity_name,
        originalUrl: result.original_url,
        newUrl: result.new_url,
        success: result.success,
        error: result.error_message
      }));
    } catch (error) {
      console.error('[ImageMigration] Error in getSessionMigrationResults:', error);
      return [];
    }
  }
}

export const imageMigrationService = new ImageMigrationService();
