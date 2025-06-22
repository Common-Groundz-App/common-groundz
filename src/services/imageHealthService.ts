
import { supabase } from '@/integrations/supabase/client';
import { imagePerformanceService } from './imagePerformanceService';

interface ImageHealthCheck {
  entityId: string;
  imageUrl: string;
  isHealthy: boolean;
  errorType?: 'timeout' | '404' | '403' | '500' | 'network' | 'unknown';
  lastChecked: Date;
  consecutiveFailures: number;
}

interface ImageHealthStats {
  totalChecked: number;
  healthyImages: number;
  brokenImages: number;
  recentFailures: ImageHealthCheck[];
  errorBreakdown: Record<string, number>;
}

class ImageHealthService {
  private readonly TIMEOUT_MS = 10000; // 10 seconds
  private readonly MAX_RETRIES = 2;
  private healthCheckResults: Map<string, ImageHealthCheck> = new Map();

  /**
   * Performs a HEAD request to check if an image URL is accessible
   */
  async checkImageHealth(imageUrl: string, entityId: string): Promise<ImageHealthCheck> {
    const startTime = Date.now();
    let consecutiveFailures = this.healthCheckResults.get(entityId)?.consecutiveFailures || 0;
    
    try {
      console.log(`[ImageHealth] Checking image health for entity ${entityId}: ${imageUrl}`);
      
      // Use HEAD request to check image without downloading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
      
      const response = await fetch(imageUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageHealthChecker/1.0)',
          'Accept': 'image/*,*/*;q=0.8',
        }
      });
      
      clearTimeout(timeoutId);
      
      const isHealthy = response.ok;
      const errorType = !isHealthy ? this.getErrorType(response.status) : undefined;
      
      const healthCheck: ImageHealthCheck = {
        entityId,
        imageUrl,
        isHealthy,
        errorType,
        lastChecked: new Date(),
        consecutiveFailures: isHealthy ? 0 : consecutiveFailures + 1
      };
      
      // Store result for tracking
      this.healthCheckResults.set(entityId, healthCheck);
      
      // Track performance
      imagePerformanceService.trackImageStorage(
        'health_check',
        entityId,
        imageUrl,
        startTime,
        isHealthy,
        errorType || undefined,
        { status: response.status, consecutiveFailures: healthCheck.consecutiveFailures }
      );
      
      if (!isHealthy) {
        console.warn(`[ImageHealth] Image health check failed for entity ${entityId}: ${response.status} ${errorType}`);
      } else {
        console.log(`[ImageHealth] Image health check passed for entity ${entityId}`);
      }
      
      return healthCheck;
      
    } catch (error: any) {
      const errorType = this.getErrorTypeFromException(error);
      
      const healthCheck: ImageHealthCheck = {
        entityId,
        imageUrl,
        isHealthy: false,
        errorType,
        lastChecked: new Date(),
        consecutiveFailures: consecutiveFailures + 1
      };
      
      this.healthCheckResults.set(entityId, healthCheck);
      
      // Track performance for failed checks
      imagePerformanceService.trackImageStorage(
        'health_check',
        entityId,
        imageUrl,
        startTime,
        false,
        error.message || 'Health check failed',
        { errorType, consecutiveFailures: healthCheck.consecutiveFailures }
      );
      
      console.error(`[ImageHealth] Image health check error for entity ${entityId}:`, error.message);
      
      return healthCheck;
    }
  }

  /**
   * Checks the health of multiple entity images
   */
  async checkMultipleImages(entities: Array<{ id: string; image_url: string }>): Promise<ImageHealthCheck[]> {
    console.log(`[ImageHealth] Starting batch health check for ${entities.length} entities`);
    
    const results: ImageHealthCheck[] = [];
    
    // Process in batches to avoid overwhelming external servers
    const batchSize = 5;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      const batchPromises = batch.map(entity => 
        this.checkImageHealth(entity.image_url, entity.id)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be respectful to external servers
      if (i + batchSize < entities.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[ImageHealth] Batch health check completed. ${results.filter(r => !r.isHealthy).length} broken images found`);
    
    return results;
  }

  /**
   * Gets entities that need image health checks (external images only)
   */
  async getEntitiesForHealthCheck(): Promise<Array<{ id: string; image_url: string; name: string }>> {
    try {
      const { data: entities, error } = await supabase
        .from('entities')
        .select('id, name, image_url')
        .eq('is_deleted', false)
        .not('image_url', 'is', null)
        .not('image_url', 'like', '%entity-images%') // Skip already stored images
        .not('image_url', 'like', '%storage.googleapis.com%') // Skip stored images
        .order('updated_at', { ascending: true }) // Check oldest first
        .limit(100); // Reasonable batch size
      
      if (error) {
        console.error('[ImageHealth] Error fetching entities for health check:', error);
        return [];
      }
      
      return entities || [];
    } catch (error) {
      console.error('[ImageHealth] Error in getEntitiesForHealthCheck:', error);
      return [];
    }
  }

  /**
   * Marks entities with broken images for refresh
   */
  async markBrokenImagesForRefresh(brokenImages: ImageHealthCheck[]): Promise<void> {
    if (brokenImages.length === 0) return;
    
    console.log(`[ImageHealth] Marking ${brokenImages.length} entities with broken images for refresh`);
    
    const entityIds = brokenImages.map(img => img.entityId);
    
    try {
      // Update entities to indicate they need image refresh
      const { error } = await supabase
        .from('entities')
        .update({ 
          updated_at: new Date().toISOString(),
          // Note: We could add a needs_image_refresh column in the future
        })
        .in('id', entityIds);
      
      if (error) {
        console.error('[ImageHealth] Error marking entities for refresh:', error);
      } else {
        console.log(`[ImageHealth] Successfully marked ${entityIds.length} entities for refresh`);
      }
    } catch (error) {
      console.error('[ImageHealth] Error in markBrokenImagesForRefresh:', error);
    }
  }

  /**
   * Gets comprehensive health statistics for admin dashboard
   */
  getHealthStats(): ImageHealthStats {
    const results = Array.from(this.healthCheckResults.values());
    const recentFailures = results
      .filter(r => !r.isHealthy)
      .sort((a, b) => b.lastChecked.getTime() - a.lastChecked.getTime())
      .slice(0, 20); // Latest 20 failures
    
    const errorBreakdown: Record<string, number> = {};
    results.forEach(result => {
      if (!result.isHealthy && result.errorType) {
        errorBreakdown[result.errorType] = (errorBreakdown[result.errorType] || 0) + 1;
      }
    });
    
    return {
      totalChecked: results.length,
      healthyImages: results.filter(r => r.isHealthy).length,
      brokenImages: results.filter(r => !r.isHealthy).length,
      recentFailures,
      errorBreakdown
    };
  }

  /**
   * Gets recent health check results for admin display
   */
  getRecentHealthChecks(limit: number = 50): ImageHealthCheck[] {
    return Array.from(this.healthCheckResults.values())
      .sort((a, b) => b.lastChecked.getTime() - a.lastChecked.getTime())
      .slice(0, limit);
  }

  /**
   * Runs a comprehensive health check on stored entities
   */
  async runHealthCheckCycle(): Promise<{ checked: number; broken: number; }> {
    console.log('[ImageHealth] Starting health check cycle');
    
    const entities = await this.getEntitiesForHealthCheck();
    if (entities.length === 0) {
      console.log('[ImageHealth] No entities found for health checking');
      return { checked: 0, broken: 0 };
    }
    
    const results = await this.checkMultipleImages(entities);
    const brokenImages = results.filter(r => !r.isHealthy);
    
    if (brokenImages.length > 0) {
      await this.markBrokenImagesForRefresh(brokenImages);
    }
    
    console.log(`[ImageHealth] Health check cycle completed: ${results.length} checked, ${brokenImages.length} broken`);
    
    return {
      checked: results.length,
      broken: brokenImages.length
    };
  }

  private getErrorType(status: number): ImageHealthCheck['errorType'] {
    if (status === 404) return '404';
    if (status === 403) return '403';
    if (status >= 500) return '500';
    return 'unknown';
  }

  private getErrorTypeFromException(error: any): ImageHealthCheck['errorType'] {
    if (error.name === 'AbortError') return 'timeout';
    if (error.message?.includes('network') || error.message?.includes('fetch')) return 'network';
    return 'unknown';
  }
}

export const imageHealthService = new ImageHealthService();
