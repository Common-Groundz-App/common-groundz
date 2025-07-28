import { supabase } from '@/integrations/supabase/client';
import { fetchImageWithRetries, uploadImageToStorageWithRetries, generateSafeFileName } from '@/utils/imageUtils';

export interface CachedPhoto {
  id: string;
  entity_id: string;
  source: 'google_places' | 'user_review';
  original_reference?: string;
  original_url?: string;
  cached_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size?: number;
  content_type?: string;
  cache_quality_score: number;
  is_primary: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CacheSession {
  id: string;
  entity_id: string;
  total_photos_found: number;
  photos_cached: number;
  cache_errors: number;
  session_status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
}

export class PhotoCacheService {
  private static instance: PhotoCacheService;

  static getInstance(): PhotoCacheService {
    if (!PhotoCacheService.instance) {
      PhotoCacheService.instance = new PhotoCacheService();
    }
    return PhotoCacheService.instance;
  }

  // Get cached photos for an entity
  async getCachedPhotos(entityId: string, limit = 8): Promise<CachedPhoto[]> {
    try {
      const { data, error } = await supabase
        .from('cached_photos')
        .select('*')
        .eq('entity_id', entityId)
        .order('is_primary', { ascending: false })
        .order('cache_quality_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching cached photos:', error);
        return [];
      }

      return (data || []) as CachedPhoto[];
    } catch (error) {
      console.error('Error in getCachedPhotos:', error);
      return [];
    }
  }

  // Cache a photo from external source
  async cachePhoto(
    entityId: string,
    originalUrl: string,
    source: 'google_places' | 'user_review',
    originalReference?: string,
    isPrimary = false
  ): Promise<CachedPhoto | null> {
    try {
      console.log(`Caching photo for entity ${entityId}:`, originalUrl);

      // Check if photo is already cached
      const { data: existingPhoto } = await supabase
        .from('cached_photos')
        .select('*')
        .eq('entity_id', entityId)
        .eq('original_url', originalUrl)
        .single();

      if (existingPhoto) {
        console.log('Photo already cached, returning existing:', originalUrl);
        return existingPhoto as CachedPhoto;
      }

      // Download the image
      const blob = await fetchImageWithRetries(originalUrl);
      if (!blob) {
        console.error('Failed to fetch image');
        return null;
      }

      // Upload to storage
      const uploadResult = await uploadImageToStorageWithRetries(blob, entityId, originalUrl);
      if (!uploadResult) {
        console.error('Failed to upload image to storage');
        return null;
      }

      // Get image metadata
      const { width, height, fileSize, contentType } = await this.getImageMetadata(originalUrl);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(width, height, fileSize);

      // Insert into cached_photos table
      const { data, error } = await supabase
        .from('cached_photos')
        .insert({
          entity_id: entityId,
          source,
          original_reference: originalReference,
          original_url: originalUrl,
          cached_url: uploadResult,
          width,
          height,
          file_size: fileSize,
          content_type: contentType,
          cache_quality_score: qualityScore,
          is_primary: isPrimary,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting cached photo:', error);
        return null;
      }

      console.log('Successfully cached photo:', data);
      return data as CachedPhoto;
    } catch (error) {
      console.error('Error caching photo:', error);
      return null;
    }
  }

  // Start a caching session for an entity
  async startCacheSession(entityId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('photo_cache_sessions')
        .insert({
          entity_id: entityId,
          session_status: 'running'
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting cache session:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error in startCacheSession:', error);
      return null;
    }
  }

  // Update cache session progress
  async updateCacheSession(
    sessionId: string,
    updates: Partial<Pick<CacheSession, 'total_photos_found' | 'photos_cached' | 'cache_errors' | 'session_status'>>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        ...(updates.session_status === 'completed' || updates.session_status === 'failed' 
          ? { completed_at: new Date().toISOString() } 
          : {})
      };

      const { error } = await supabase
        .from('photo_cache_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating cache session:', error);
      }
    } catch (error) {
      console.error('Error in updateCacheSession:', error);
    }
  }

  // Check if photos are already cached for an entity
  async hasCachedPhotos(entityId: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('cached_photos')
        .select('*', { count: 'exact', head: true })
        .eq('entity_id', entityId);

      if (error) {
        console.error('Error checking cached photos:', error);
        return false;
      }

      return (count || 0) > 0;
    } catch (error) {
      console.error('Error in hasCachedPhotos:', error);
      return false;
    }
  }

  // Clean up expired cached photos
  async cleanupExpiredPhotos(): Promise<void> {
    try {
      const { data: expiredPhotos, error } = await supabase
        .from('cached_photos')
        .select('cached_url, thumbnail_url')
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching expired photos:', error);
        return;
      }

      // Delete files from storage
      if (expiredPhotos && expiredPhotos.length > 0) {
        const filesToDelete = expiredPhotos.flatMap(photo => [
          photo.cached_url.split('/').pop(),
          photo.thumbnail_url?.split('/').pop()
        ].filter(Boolean));

        if (filesToDelete.length > 0) {
          await supabase.storage
            .from('entity-images')
            .remove(filesToDelete);
        }

        // Delete records from database
        await supabase
          .from('cached_photos')
          .delete()
          .lt('expires_at', new Date().toISOString());
      }
    } catch (error) {
      console.error('Error cleaning up expired photos:', error);
    }
  }

  // Get image metadata
  private async getImageMetadata(imageUrl: string): Promise<{
    width?: number;
    height?: number;
    fileSize?: number;
    contentType?: string;
  }> {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || undefined;
      const contentLength = response.headers.get('content-length');
      const fileSize = contentLength ? parseInt(contentLength, 10) : undefined;

      return {
        contentType,
        fileSize
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return {};
    }
  }

  // Calculate quality score based on image properties
  private calculateQualityScore(width?: number, height?: number, fileSize?: number): number {
    let score = 50; // Base score

    if (width && height) {
      const resolution = width * height;
      if (resolution >= 1000000) score += 30; // High resolution
      else if (resolution >= 500000) score += 20; // Medium resolution
      else if (resolution >= 100000) score += 10; // Low resolution
    }

    if (fileSize) {
      if (fileSize > 500000) score += 10; // Large file (likely good quality)
      else if (fileSize > 100000) score += 5; // Medium file
    }

    return Math.min(100, Math.max(0, score));
  }
}
