
import { supabase } from '@/integrations/supabase/client';
import { createEntityQuick, queueEntityForEnrichment } from '@/services/enhancedEntityService';
import { EntityTypeString } from '@/hooks/feed/api/types';

interface EntityCreationQueue {
  id: string;
  externalData: any;
  entityType: EntityTypeString;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

class EntityCreationService {
  private queue: Map<string, EntityCreationQueue> = new Map();
  private processingQueue: Set<string> = new Set();

  /**
   * Queue entity for creation with progress tracking
   */
  async queueEntityCreation(
    tempId: string, 
    externalData: any, 
    entityType: EntityTypeString
  ): Promise<string> {
    console.log('🔄 Queuing entity creation:', externalData.name);
    
    const queueItem: EntityCreationQueue = {
      id: tempId,
      externalData,
      entityType,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    };
    
    this.queue.set(tempId, queueItem);
    
    // Start processing immediately (non-blocking)
    this.processEntityCreation(tempId);
    
    return tempId;
  }

  /**
   * Get creation progress for a queued entity
   */
  getCreationProgress(tempId: string): EntityCreationQueue | null {
    return this.queue.get(tempId) || null;
  }

  /**
   * Process entity creation in background
   */
  private async processEntityCreation(tempId: string): Promise<void> {
    if (this.processingQueue.has(tempId)) {
      console.log('⚠️ Entity already being processed:', tempId);
      return;
    }

    this.processingQueue.add(tempId);
    const queueItem = this.queue.get(tempId);
    
    if (!queueItem) {
      console.error('❌ Queue item not found:', tempId);
      this.processingQueue.delete(tempId);
      return;
    }

    try {
      console.log('🚀 Starting background entity creation for:', queueItem.externalData.name);
      
      // Update status to processing
      queueItem.status = 'processing';
      queueItem.progress = 10;
      this.queue.set(tempId, queueItem);

      // Step 1: Quick entity creation (database INSERT only)
      console.log('⚡ Quick entity creation...');
      queueItem.progress = 30;
      this.queue.set(tempId, queueItem);
      
      const entity = await createEntityQuick(queueItem.externalData, queueItem.entityType);
      
      if (!entity) {
        throw new Error('Failed to create entity');
      }

      console.log('✅ Entity created:', entity.name);
      queueItem.progress = 60;
      this.queue.set(tempId, queueItem);

      // Step 2: Schedule background enrichment (fire-and-forget)
      if (queueItem.externalData.api_source === 'google_places' && queueItem.externalData.api_ref) {
        console.log('🖼️ Scheduling background photo enrichment...');
        setTimeout(() => {
          supabase.functions.invoke('refresh-google-places-entity', {
            body: { entityId: entity.id, placeId: queueItem.externalData.api_ref }
          }).catch(err => console.error('Background enrichment failed:', err));
        }, 3000); // 3 seconds delay
      } else {
        console.log('📋 Queuing for background enrichment...');
        await queueEntityForEnrichment(entity.id, 5);
      }
      
      queueItem.progress = 90;
      this.queue.set(tempId, queueItem);

      // Step 3: Final completion
      queueItem.status = 'completed';
      queueItem.progress = 100;
      queueItem.completedAt = new Date();
      this.queue.set(tempId, queueItem);

      console.log('🎉 Entity creation completed successfully:', entity.name);

      // Notify subscribers about completion (if needed)
      this.notifyCompletion(tempId, entity);

    } catch (error) {
      console.error('❌ Entity creation failed:', error);
      
      queueItem.status = 'failed';
      queueItem.error = error instanceof Error ? error.message : 'Unknown error';
      this.queue.set(tempId, queueItem);
      
      // Notify about failure
      this.notifyFailure(tempId, queueItem.error);
    } finally {
      this.processingQueue.delete(tempId);
      
      // Clean up completed/failed items after 5 minutes
      setTimeout(() => {
        this.queue.delete(tempId);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Notify completion (can be extended to use WebSocket/EventSource)
   */
  private notifyCompletion(tempId: string, entity: any): void {
    console.log('📢 Entity creation completed notification:', {
      tempId,
      entityId: entity.id,
      entityName: entity.name
    });
    
    // Can be extended to emit events or use WebSocket for real-time updates
    window.dispatchEvent(new CustomEvent('entityCreationCompleted', {
      detail: { tempId, entity }
    }));
  }

  /**
   * Notify failure
   */
  private notifyFailure(tempId: string, error: string): void {
    console.log('📢 Entity creation failed notification:', { tempId, error });
    
    window.dispatchEvent(new CustomEvent('entityCreationFailed', {
      detail: { tempId, error }
    }));
  }

  /**
   * Get queue statistics for monitoring
   */
  getQueueStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const items = Array.from(this.queue.values());
    
    return {
      total: items.length,
      pending: items.filter(item => item.status === 'pending').length,
      processing: items.filter(item => item.status === 'processing').length,
      completed: items.filter(item => item.status === 'completed').length,
      failed: items.filter(item => item.status === 'failed').length
    };
  }

  /**
   * Clear completed and failed items
   */
  clearCompleted(): void {
    const toDelete = Array.from(this.queue.entries())
      .filter(([_, item]) => item.status === 'completed' || item.status === 'failed')
      .map(([id]) => id);
    
    toDelete.forEach(id => this.queue.delete(id));
    
    console.log(`🧹 Cleared ${toDelete.length} completed/failed items from queue`);
  }
}

// Export singleton instance
export const entityCreationService = new EntityCreationService();

// Export types for external use
export type { EntityCreationQueue };
