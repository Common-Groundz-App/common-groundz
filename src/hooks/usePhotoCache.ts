import { useState, useEffect, useCallback } from 'react';
import { PhotoCacheService, CachedPhoto } from '@/services/photoCacheService';
import { PhotoValidationService } from '@/services/photoValidationService';
import { fetchGooglePlacesPhotos, fetchEntityReviewMedia, PhotoWithMetadata } from '@/services/photoService';

interface UsePhotoCacheOptions {
  entityId: string;
  entity?: any; // Add entity data for photo fetching
  initialLoadCount?: number;
  enableBackgroundCaching?: boolean;
}

interface UsePhotoCacheResult {
  photos: PhotoWithMetadata[];
  cachedPhotos: CachedPhoto[];
  isLoading: boolean;
  isCaching: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refreshCache: () => Promise<void>;
  cacheProgress: {
    total: number;
    cached: number;
    errors: number;
  };
}

export const usePhotoCache = ({
  entityId,
  entity,
  initialLoadCount = 8,
  enableBackgroundCaching = true
}: UsePhotoCacheOptions): UsePhotoCacheResult => {
  const [photos, setPhotos] = useState<PhotoWithMetadata[]>([]);
  const [cachedPhotos, setCachedPhotos] = useState<CachedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCaching, setIsCaching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [cacheProgress, setCacheProgress] = useState({
    total: 0,
    cached: 0,
    errors: 0
  });

  const photoCacheService = PhotoCacheService.getInstance();
  const photoValidationService = PhotoValidationService.getInstance();

  // Load initial cached photos
  const loadCachedPhotos = useCallback(async () => {
    try {
      const cached = await photoCacheService.getCachedPhotos(entityId, initialLoadCount);
      setCachedPhotos(cached);
      
      // Convert cached photos to PhotoWithMetadata format
      const cachedAsPhotos: PhotoWithMetadata[] = cached.map((photo, index) => ({
        url: photo.cached_url,
        type: 'image' as const,
        order: index,
        source: photo.source,
        originalReference: photo.original_reference,
        width: photo.width,
        height: photo.height,
        fileSize: photo.file_size,
        contentType: photo.content_type,
        isPrimary: photo.is_primary,
        isCached: true
      }));

      setPhotos(cachedAsPhotos);
      setLoadedCount(cached.length);
      
      return cached;
    } catch (error) {
      console.error('Error loading cached photos:', error);
      return [];
    }
  }, [entityId, initialLoadCount, photoCacheService]);

  // Load fresh photos from external sources
  const loadFreshPhotos = useCallback(async (entity: any) => {
    try {
      const [googlePhotos, reviewPhotos] = await Promise.all([
        fetchGooglePlacesPhotos(entity),
        fetchEntityReviewMedia(entityId)
      ]);

      const allFreshPhotos = [...googlePhotos, ...reviewPhotos];
      
      // Filter out photos that are already cached
      const uncachedPhotos = allFreshPhotos.filter(photo => 
        !cachedPhotos.some(cached => cached.original_url === photo.url)
      );

      return { allFreshPhotos, uncachedPhotos };
    } catch (error) {
      console.error('Error loading fresh photos:', error);
      return { allFreshPhotos: [], uncachedPhotos: [] };
    }
  }, [entityId, cachedPhotos]);

  // Cache photos in background
  const cachePhotosInBackground = useCallback(async (photosToCache: PhotoWithMetadata[]) => {
    if (photosToCache.length === 0) return;

    setIsCaching(true);
    setCacheProgress({ total: photosToCache.length, cached: 0, errors: 0 });

    const sessionId = await photoCacheService.startCacheSession(entityId);
    if (!sessionId) return;

    let cached = 0;
    let errors = 0;

    for (const photo of photosToCache) {
      try {
        // Validate photo first
        const validation = await photoValidationService.validatePhoto(photo.url);
        
        if (validation.isValid) {
          const cachedPhoto = await photoCacheService.cachePhoto(
            entityId,
            photo.url,
            photo.source as 'google_places' | 'user_review',
            photo.originalReference,
            photo.isPrimary
          );

          if (cachedPhoto) {
            cached++;
            // Update photos state with cached version
            setPhotos(prev => prev.map(p => 
              p.url === photo.url 
                ? { ...p, url: cachedPhoto.cached_url, isCached: true }
                : p
            ));
          } else {
            errors++;
          }
        } else {
          errors++;
        }

        setCacheProgress({ total: photosToCache.length, cached, errors });
        
        // Update session progress
        await photoCacheService.updateCacheSession(sessionId, {
          total_photos_found: photosToCache.length,
          photos_cached: cached,
          cache_errors: errors
        });

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error caching photo:', error);
        errors++;
        setCacheProgress({ total: photosToCache.length, cached, errors });
      }
    }

    // Complete the session
    await photoCacheService.updateCacheSession(sessionId, {
      session_status: cached > 0 ? 'completed' : 'failed'
    });

    setIsCaching(false);
  }, [entityId, photoCacheService, photoValidationService]);

  // Load more photos
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    try {
      setIsLoading(true);
      
      // Load more cached photos
      const moreCached = await photoCacheService.getCachedPhotos(
        entityId, 
        loadedCount + initialLoadCount
      );

      const newCachedPhotos = moreCached.slice(loadedCount);
      
      if (newCachedPhotos.length > 0) {
        const newPhotos: PhotoWithMetadata[] = newCachedPhotos.map((photo, index) => ({
          url: photo.cached_url,
          type: 'image' as const,
          order: loadedCount + index,
          source: photo.source,
          originalReference: photo.original_reference,
          width: photo.width,
          height: photo.height,
          fileSize: photo.file_size,
          contentType: photo.content_type,
          isPrimary: photo.is_primary,
          isCached: true
        }));

        setPhotos(prev => [...prev, ...newPhotos]);
        setLoadedCount(prev => prev + newPhotos.length);
      }

      // Check if we have more photos
      setHasMore(moreCached.length > loadedCount + newCachedPhotos.length);
    } catch (error) {
      console.error('Error loading more photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, hasMore, isLoading, loadedCount, initialLoadCount, photoCacheService]);

  // Refresh cache
  const refreshCache = useCallback(async () => {
    try {
      setIsLoading(true);
      await loadCachedPhotos();
    } catch (error) {
      console.error('Error refreshing cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadCachedPhotos]);

  // Initial load effect
  useEffect(() => {
    const initializePhotos = async () => {
      setIsLoading(true);
      
      try {
        // First, load any cached photos
        const cached = await loadCachedPhotos();
        
        // If we have enough cached photos, we can show them immediately
        if (cached.length >= initialLoadCount) {
          setIsLoading(false);
        }

        // Always try to load fresh photos if background caching is enabled
        if (enableBackgroundCaching && entity) {
          try {
            const { allFreshPhotos, uncachedPhotos } = await loadFreshPhotos(entity);
            
            // If we have no cached photos, show fresh photos immediately
            if (cached.length === 0 && allFreshPhotos.length > 0) {
              setPhotos(allFreshPhotos.slice(0, initialLoadCount));
              setIsLoading(false);
            }
            
            // Start background caching for uncached photos
            if (uncachedPhotos.length > 0) {
              cachePhotosInBackground(uncachedPhotos);
            }
          } catch (error) {
            console.error('Error fetching fresh photos:', error);
          }
        }
      } catch (error) {
        console.error('Error initializing photos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (entityId) {
      initializePhotos();
    }
  }, [entityId, enableBackgroundCaching, initialLoadCount, loadCachedPhotos]);

  return {
    photos,
    cachedPhotos,
    isLoading,
    isCaching,
    hasMore,
    loadMore,
    refreshCache,
    cacheProgress
  };
};