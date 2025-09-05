import { supabase } from '@/integrations/supabase/client';

export interface CachedPhoto {
  id: string;
  entity_id: string;
  original_reference: string;
  cached_url: string;
  max_width?: number;
  quality_level: string;
  expires_at: string;
  fetch_count: number;
  last_accessed_at: string;
  created_at: string;
}

export type PhotoQuality = 'high' | 'medium' | 'low';

// Quality presets for different use cases
const QUALITY_PRESETS = {
  high: 1200,     // Hero images, detailed views
  medium: 800,    // Grid views, gallery
  low: 400        // Thumbnails, previews
} as const;

export class CachedPhotoService {
  private static instance: CachedPhotoService;
  
  static getInstance(): CachedPhotoService {
    if (!CachedPhotoService.instance) {
      CachedPhotoService.instance = new CachedPhotoService();
    }
    return CachedPhotoService.instance;
  }

  /**
   * Get cached photo URL or generate new one if expired/missing
   */
  async getCachedPhotoUrl(
    photoReference: string, 
    quality: PhotoQuality = 'medium',
    entityId?: string
  ): Promise<string> {
    const maxWidth = QUALITY_PRESETS[quality];
    
    try {
      // Check for existing cached photo
      const cached = await this.getCachedPhoto(photoReference, maxWidth);
      
      if (cached && !this.isExpired(cached.expires_at)) {
        // Update last accessed time
        await this.updateLastAccessed(cached.id);
        return cached.cached_url;
      }
      
      // Generate fresh proxy URL
      const proxyUrl = this.createProxyUrl(photoReference, maxWidth);
      
      // Cache the new URL for 48 hours
      await this.cachePhotoUrl(photoReference, proxyUrl, maxWidth, quality, entityId);
      
      return proxyUrl;
    } catch (error) {
      console.error('Error getting cached photo URL:', error);
      // Fallback to direct proxy URL generation
      return this.createProxyUrl(photoReference, maxWidth);
    }
  }

  /**
   * Get multiple cached photo URLs for an entity
   */
  async getCachedPhotoUrls(
    photoReferences: string[],
    qualities: PhotoQuality[] = ['high', 'medium', 'low'],
    entityId?: string
  ): Promise<{ photoReference: string; quality: PhotoQuality; url: string }[]> {
    const results = [];
    
    for (const photoRef of photoReferences) {
      for (const quality of qualities) {
        const url = await this.getCachedPhotoUrl(photoRef, quality, entityId);
        results.push({
          photoReference: photoRef,
          quality,
          url
        });
      }
    }
    
    return results;
  }

  /**
   * Pre-cache photos for an entity (useful during entity creation)
   */
  async preCacheEntityPhotos(
    entityId: string,
    photoReferences: string[],
    qualities: PhotoQuality[] = ['medium', 'high']
  ): Promise<void> {
    try {
      const cachePromises = [];
      
      for (const photoRef of photoReferences) {
        for (const quality of qualities) {
          cachePromises.push(
            this.getCachedPhotoUrl(photoRef, quality, entityId)
          );
        }
      }
      
      await Promise.all(cachePromises);
    } catch (error) {
      console.error('Error pre-caching entity photos:', error);
    }
  }

  /**
   * Check if cached photo exists and is not expired
   */
  private async getCachedPhoto(
    photoReference: string, 
    maxWidth: number
  ): Promise<CachedPhoto | null> {
    const { data, error } = await supabase
      .from('cached_photos')
      .select('*')
      .eq('original_reference', photoReference)
      .eq('max_width', maxWidth)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching cached photo:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Check if cached photo is expired (older than 48 hours)
   */
  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  /**
   * Update last accessed timestamp and increment fetch count
   */
  private async updateLastAccessed(cachedPhotoId: string): Promise<void> {
    try {
      // First get current fetch count
      const { data: currentPhoto } = await supabase
        .from('cached_photos')
        .select('fetch_count')
        .eq('id', cachedPhotoId)
        .single();
        
      const newFetchCount = (currentPhoto?.fetch_count || 0) + 1;
      
      await supabase
        .from('cached_photos')
        .update({
          last_accessed_at: new Date().toISOString(),
          fetch_count: newFetchCount
        })
        .eq('id', cachedPhotoId);
    } catch (error) {
      console.error('Error updating last accessed:', error);
    }
  }

  /**
   * Cache a photo URL with 48-hour expiry
   */
  private async cachePhotoUrl(
    photoReference: string,
    cachedUrl: string,
    maxWidth: number,
    quality: PhotoQuality,
    entityId?: string
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours from now
      
      const { error } = await supabase
        .from('cached_photos')
        .insert({
          entity_id: entityId,
          original_reference: photoReference,
          cached_url: cachedUrl,
          max_width: maxWidth,
          quality_level: quality,
          expires_at: expiresAt.toISOString(),
          fetch_count: 1,
          last_accessed_at: new Date().toISOString(),
          source: 'google_places'
        });
        
      if (error) {
        console.error('Error caching photo URL:', error);
      }
    } catch (error) {
      console.error('Error caching photo URL:', error);
    }
  }

  /**
   * Create proxy URL for Google Places photo
   */
  private createProxyUrl(photoReference: string, maxWidth: number): string {
    const baseUrl = 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image';
    return `${baseUrl}?ref=${encodeURIComponent(photoReference)}&maxWidth=${maxWidth}`;
  }

  /**
   * Clean up expired cached photos (for maintenance)
   */
  async cleanupExpiredPhotos(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_cached_photos');
      
      if (error) {
        console.error('Error cleaning up expired photos:', error);
        return 0;
      }
      
      return data || 0;
    } catch (error) {
      console.error('Error cleaning up expired photos:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    expired: number;
    byQuality: Record<string, number>;
    byEntity: Record<string, number>;
  }> {
    try {
      const { data: totalData } = await supabase
        .from('cached_photos')
        .select('*', { count: 'exact', head: true });
        
      const { data: expiredData } = await supabase
        .from('cached_photos')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString());

      const { data: qualityData } = await supabase
        .from('cached_photos')
        .select('quality_level')
        .gte('expires_at', new Date().toISOString());

      const { data: entityData } = await supabase
        .from('cached_photos')
        .select('entity_id')
        .gte('expires_at', new Date().toISOString())
        .not('entity_id', 'is', null);

      // Group by quality
      const byQuality: Record<string, number> = {};
      qualityData?.forEach(item => {
        byQuality[item.quality_level] = (byQuality[item.quality_level] || 0) + 1;
      });

      // Group by entity
      const byEntity: Record<string, number> = {};
      entityData?.forEach(item => {
        if (item.entity_id) {
          byEntity[item.entity_id] = (byEntity[item.entity_id] || 0) + 1;
        }
      });

      return {
        totalCached: totalData?.length || 0,
        expired: expiredData?.length || 0,
        byQuality,
        byEntity
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalCached: 0,
        expired: 0,
        byQuality: {},
        byEntity: {}
      };
    }
  }
}

// Export singleton instance
export const cachedPhotoService = CachedPhotoService.getInstance();