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
  lastSessionDate?: Date;
  sessionId?: string;
}

interface ImageHealthSession {
  id: string;
  total_checked: number;
  healthy_count: number;
  broken_count: number;
  error_breakdown: Record<string, number>;
  started_at: string;
  completed_at?: string;
}

class ImageHealthService {
  private readonly TIMEOUT_MS = 10000; // 10 seconds
  private readonly MAX_RETRIES = 2;
  private healthCheckResults: Map<string, ImageHealthCheck> = new Map();

  /**
   * Type guard to safely convert Json to Record<string, number>
   */
  private isValidErrorBreakdown(value: any): value is Record<string, number> {
    if (!value || typeof value !== 'object') {
      return false;
    }
    
    return Object.entries(value).every(([key, val]) => 
      typeof key === 'string' && typeof val === 'number'
    );
  }

  /**
   * Safely converts Json to Record<string, number>
   */
  private convertErrorBreakdown(value: any): Record<string, number> {
    if (this.isValidErrorBreakdown(value)) {
      return value;
    }
    return {};
  }

  /**
   * Gets the latest health session from the database
   */
  async getLatestHealthSession(): Promise<ImageHealthSession | null> {
    try {
      const { data, error } = await supabase
        .from('image_health_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[ImageHealth] Error fetching latest session:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        total_checked: data.total_checked,
        healthy_count: data.healthy_count,
        broken_count: data.broken_count,
        error_breakdown: this.convertErrorBreakdown(data.error_breakdown),
        started_at: data.started_at,
        completed_at: data.completed_at
      };
    } catch (error) {
      console.error('[ImageHealth] Error in getLatestHealthSession:', error);
      return null;
    }
  }

  /**
   * Gets health results for a specific session
   */
  async getSessionResults(sessionId: string): Promise<ImageHealthCheck[]> {
    try {
      const { data, error } = await supabase
        .from('image_health_results')
        .select('*')
        .eq('session_id', sessionId)
        .order('checked_at', { ascending: false });

      if (error) {
        console.error('[ImageHealth] Error fetching session results:', error);
        return [];
      }

      return (data || []).map(result => ({
        entityId: result.entity_id,
        imageUrl: result.image_url,
        isHealthy: result.is_healthy,
        errorType: result.error_type as ImageHealthCheck['errorType'],
        lastChecked: new Date(result.checked_at),
        consecutiveFailures: result.consecutive_failures
      }));
    } catch (error) {
      console.error('[ImageHealth] Error in getSessionResults:', error);
      return [];
    }
  }

  /**
   * Creates a new health check session
   */
  async createHealthSession(): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('image_health_sessions')
        .insert({
          total_checked: 0,
          healthy_count: 0,
          broken_count: 0,
          error_breakdown: {},
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('[ImageHealth] Error creating session:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('[ImageHealth] Error in createHealthSession:', error);
      return null;
    }
  }

  /**
   * Updates a health session with final statistics
   */
  async updateHealthSession(sessionId: string, stats: {
    totalChecked: number;
    healthyCount: number;
    brokenCount: number;
    errorBreakdown: Record<string, number>;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('image_health_sessions')
        .update({
          total_checked: stats.totalChecked,
          healthy_count: stats.healthyCount,
          broken_count: stats.brokenCount,
          error_breakdown: stats.errorBreakdown,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[ImageHealth] Error updating session:', error);
      }
    } catch (error) {
      console.error('[ImageHealth] Error in updateHealthSession:', error);
    }
  }

  /**
   * Saves an individual health check result to the database
   */
  async saveHealthResult(result: ImageHealthCheck, sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('image_health_results')
        .insert({
          entity_id: result.entityId,
          image_url: result.imageUrl,
          is_healthy: result.isHealthy,
          error_type: result.errorType || null,
          consecutive_failures: result.consecutiveFailures,
          checked_at: result.lastChecked.toISOString(),
          session_id: sessionId
        });

      if (error) {
        console.error('[ImageHealth] Error saving health result:', error);
      }
    } catch (error) {
      console.error('[ImageHealth] Error in saveHealthResult:', error);
    }
  }

  /**
   * Performs a HEAD request to check if an image URL is accessible
   */
  async checkImageHealth(imageUrl: string, entityId: string, sessionId?: string): Promise<ImageHealthCheck> {
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
      
      // Save to database if sessionId provided
      if (sessionId) {
        await this.saveHealthResult(healthCheck, sessionId);
      }
      
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
      
      // Save to database if sessionId provided
      if (sessionId) {
        await this.saveHealthResult(healthCheck, sessionId);
      }
      
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
  async checkMultipleImages(entities: Array<{ id: string; image_url: string }>, sessionId?: string): Promise<ImageHealthCheck[]> {
    console.log(`[ImageHealth] Starting batch health check for ${entities.length} entities`);
    
    const results: ImageHealthCheck[] = [];
    
    // Process in batches to avoid overwhelming external servers
    const batchSize = 5;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      const batchPromises = batch.map(entity => 
        this.checkImageHealth(entity.image_url, entity.id, sessionId)
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
  async getHealthStats(): Promise<ImageHealthStats> {
    try {
      // Get the latest session from database
      const latestSession = await this.getLatestHealthSession();
      
      if (!latestSession) {
        // No sessions exist, return empty stats
        return {
          totalChecked: 0,
          healthyImages: 0,
          brokenImages: 0,
          recentFailures: [],
          errorBreakdown: {}
        };
      }

      // Get results for the latest session
      const sessionResults = await this.getSessionResults(latestSession.id);
      const recentFailures = sessionResults
        .filter(r => !r.isHealthy)
        .slice(0, 20); // Latest 20 failures

      return {
        totalChecked: latestSession.total_checked,
        healthyImages: latestSession.healthy_count,
        brokenImages: latestSession.broken_count,
        recentFailures,
        errorBreakdown: latestSession.error_breakdown,
        lastSessionDate: new Date(latestSession.started_at),
        sessionId: latestSession.id
      };
    } catch (error) {
      console.error('[ImageHealth] Error getting health stats:', error);
      return {
        totalChecked: 0,
        healthyImages: 0,
        brokenImages: 0,
        recentFailures: [],
        errorBreakdown: {}
      };
    }
  }

  /**
   * Gets recent health check results for admin display
   */
  async getRecentHealthChecks(limit: number = 50): Promise<ImageHealthCheck[]> {
    try {
      const latestSession = await this.getLatestHealthSession();
      if (!latestSession) {
        return [];
      }

      const { data, error } = await supabase
        .from('image_health_results')
        .select('*')
        .eq('session_id', latestSession.id)
        .order('checked_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ImageHealth] Error fetching recent health checks:', error);
        return [];
      }

      return (data || []).map(result => ({
        entityId: result.entity_id,
        imageUrl: result.image_url,
        isHealthy: result.is_healthy,
        errorType: result.error_type as ImageHealthCheck['errorType'],
        lastChecked: new Date(result.checked_at),
        consecutiveFailures: result.consecutive_failures
      }));
    } catch (error) {
      console.error('[ImageHealth] Error in getRecentHealthChecks:', error);
      return [];
    }
  }

  /**
   * Runs a comprehensive health check on stored entities
   */
  async runHealthCheckCycle(): Promise<{ checked: number; broken: number; }> {
    console.log('[ImageHealth] Starting health check cycle');
    
    // Create a new session
    const sessionId = await this.createHealthSession();
    if (!sessionId) {
      throw new Error('Failed to create health check session');
    }
    
    const entities = await this.getEntitiesForHealthCheck();
    if (entities.length === 0) {
      console.log('[ImageHealth] No entities found for health checking');
      
      // Update session with empty results
      await this.updateHealthSession(sessionId, {
        totalChecked: 0,
        healthyCount: 0,
        brokenCount: 0,
        errorBreakdown: {}
      });
      
      return { checked: 0, broken: 0 };
    }
    
    const results = await this.checkMultipleImages(entities, sessionId);
    const brokenImages = results.filter(r => !r.isHealthy);
    
    // Calculate error breakdown
    const errorBreakdown: Record<string, number> = {};
    brokenImages.forEach(result => {
      if (result.errorType) {
        errorBreakdown[result.errorType] = (errorBreakdown[result.errorType] || 0) + 1;
      }
    });
    
    // Update session with final statistics
    await this.updateHealthSession(sessionId, {
      totalChecked: results.length,
      healthyCount: results.length - brokenImages.length,
      brokenCount: brokenImages.length,
      errorBreakdown
    });
    
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
