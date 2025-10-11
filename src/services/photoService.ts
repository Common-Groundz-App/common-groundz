import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { cachedPhotoService, type PhotoQuality as CachedPhotoQuality } from './cachedPhotoService';

export interface PhotoWithMetadata extends MediaItem {
  source: 'google_places' | 'user_review' | 'entity_photo';
  originalReference?: string;
  reviewId?: string;
  reviewTitle?: string;
  username?: string;
  createdAt?: string;
  isCached?: boolean;
  isPrimary?: boolean;
  width?: number;
  height?: number;
  fileSize?: number;
  contentType?: string;
  isTimelineUpdate?: boolean;
  timelineComment?: string;
  category?: string;
}

/**
 * Check if a URL is from a trusted source (Google Places edge function)
 */
const isTrustedSource = (url: string): boolean => {
  return url.includes('supabase.co/functions/v1/proxy-google-image');
};

/**
 * Validate if a photo URL is accessible (only for untrusted sources)
 */
const validatePhotoUrl = async (url: string): Promise<boolean> => {
  // Skip validation for trusted sources (Google Places via edge function)
  if (isTrustedSource(url)) {
    return true;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('⚠️ Photo validation failed for URL:', url, error);
    return false;
  }
};

// Photo quality presets
export type PhotoQuality = 'high' | 'medium' | 'low';

const PHOTO_QUALITY_SETTINGS = {
  high: 1200,    // Main/hero images
  medium: 800,   // Grid images  
  low: 400       // Thumbnails
} as const;

/**
 * Create a Google Places photo URL using proxy-google-image function
 */
export const createGooglePlacesPhotoUrl = (
  photoReference: string, 
  quality: PhotoQuality | number = 'medium'
): string => {
  try {
    const maxWidth = typeof quality === 'number' ? quality : PHOTO_QUALITY_SETTINGS[quality];
    const baseUrl = 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image';
    const params = new URLSearchParams({
      ref: photoReference,
      maxWidth: maxWidth.toString()
    });
    return `${baseUrl}?${params.toString()}`;
  } catch (error) {
    console.error('❌ Error creating photo URL:', error);
    throw error;
  }
};

/**
 * Fetch Google Places photos for an entity with optimized 48-hour caching
 */
import { hasStoredPhotos, hasPhotoReferences } from '@/types/metadata';

export const fetchGooglePlacesPhotos = async (
  entity: Entity, 
  qualityPreference?: PhotoQuality[]
): Promise<PhotoWithMetadata[]> => {
  const startTime = performance.now();
  const photos: PhotoWithMetadata[] = [];
  
  try {
    // Method 1: Use permanent Supabase Storage URLs (NEW - zero Google API calls)
    if (hasStoredPhotos(entity)) {
      const storedPhotos = entity.metadata.stored_photo_urls;
      
      for (let i = 0; i < storedPhotos.length; i++) {
        const stored = storedPhotos[i];
        photos.push({
          id: `stored-place-${entity.id}-${i}`,
          url: stored.storedUrl,
          type: 'image',
          alt: entity.name,
          order: i,
          source: 'google_places',
          originalReference: stored.reference,
          isPrimary: i === 0,
          isCached: true,
          width: stored.width,
          height: stored.height
        });
      }
      
      console.log(`✅ Loaded ${photos.length} photos from Supabase Storage (0 Google API calls, ${(performance.now() - startTime).toFixed(1)}ms)`);
      return photos;
    }
    
    // Method 2: Use stored photo_references array (optimized with batch caching - legacy)
    if (entity.metadata?.photo_references && Array.isArray(entity.metadata.photo_references)) {
      const photoRefs = entity.metadata.photo_references;
      console.log(`🚀 [PhotoService] Fetching photos for ${photoRefs.length} references for entity ${entity.id}`);
      
      // Extract unique qualities (removing duplicates from quality preference)
      const uniqueQualities = qualityPreference ? 
        [...new Set(qualityPreference)] as PhotoQuality[] :
        ['high', 'medium'] as PhotoQuality[];
      
      console.log(`📊 [PhotoService] Quality preference: [${qualityPreference?.join(', ')}] → unique: [${uniqueQualities.join(', ')}]`);
      
      // Use batch method for better performance with deduplication
      const batchResults = await cachedPhotoService.getCachedPhotoUrls(
        photoRefs.map(ref => ref.photo_reference),
        uniqueQualities,
        entity.id
      );
      
      // Map results back to photos array maintaining original order and quality preferences
      for (let index = 0; index < photoRefs.length; index++) {
        const photoRef = photoRefs[index];
        const requestedQuality = qualityPreference?.[index] || (index === 0 ? 'high' : 'medium');
        
        // Find the matching result from batch
        const batchResult = batchResults.find(result => 
          result.photoReference === photoRef.photo_reference && 
          result.quality === requestedQuality
        );
        
        if (batchResult) {
          const maxWidth = typeof requestedQuality === 'number' ? requestedQuality : PHOTO_QUALITY_SETTINGS[requestedQuality];
          
          photos.push({
            id: `google-places-${entity.id}-${index}`,
            url: batchResult.url,
            type: 'image' as const,
            alt: entity.name,
            order: index,
            source: 'google_places' as const,
            originalReference: photoRef.photo_reference,
            isPrimary: index === 0,
            isCached: true, // Flag to indicate this is using cached URL
            width: photoRef.width || maxWidth,
            height: photoRef.height || maxWidth
          });
        }
      }
      
      console.log(`✅ Successfully fetched ${photos.length} cached Google Places photos`);
      return photos;
    }

    // Method 2: Fallback to single photo reference (backward compatibility with caching)
    const photoRef = entity.metadata?.photo_reference;
    if (photoRef) {
      const quality = qualityPreference?.[0] || 'high';
      
      // Get cached photo URL
      const photoUrl = await cachedPhotoService.getCachedPhotoUrl(
        photoRef, 
        quality as CachedPhotoQuality, 
        entity.id
      );
      
      const maxWidth = typeof quality === 'number' ? quality : PHOTO_QUALITY_SETTINGS[quality];
      
      photos.push({
        id: `google-places-${entity.id}`,
        url: photoUrl,
        type: 'image' as const,
        alt: entity.name,
        order: 0,
        source: 'google_places' as const,
        originalReference: photoRef,
        isPrimary: true,
        isCached: true,
        width: maxWidth,
        height: maxWidth
      });
      console.log('✅ Added cached Google Places photo (fallback)');
    } else {
      console.log('🖼️ No photo reference found in metadata');
    }
  } catch (error) {
    console.error('❌ Error fetching cached Google Places photos:', error);
  }
  
  console.log(`⚡ [PhotoService] Total fetch completed in ${(performance.now() - startTime).toFixed(1)}ms for ${photos.length} photos`);
  return photos;
};

/**
 * Fetch review media for an entity
 */
export const fetchEntityReviewMedia = async (entityId: string): Promise<PhotoWithMetadata[]> => {
  const photos: PhotoWithMetadata[] = [];
  
  try {
    console.log('📸 Fetching review media for entity:', entityId);
    
    // First get reviews with media, then get user profiles separately
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('id, title, media, created_at, user_id')
      .eq('entity_id', entityId)
      .eq('status', 'published')
      .not('media', 'is', null)
      .neq('media', '[]');
    
    if (reviewsError) {
      console.error('❌ Error fetching reviews:', reviewsError);
      return photos;
    }
    
    console.log('📸 Found reviews with media:', reviews?.length || 0);
    
    // Also fetch review updates with media
    const { data: reviewUpdates, error: updatesError } = await supabase
      .from('review_updates')
      .select(`
        id, 
        review_id, 
        comment, 
        media, 
        created_at, 
        user_id,
        reviews!inner(entity_id, title, status)
      `)
      .eq('reviews.entity_id', entityId)
      .eq('reviews.status', 'published')
      .not('media', 'is', null)
      .neq('media', '[]');
    
    if (updatesError) {
      console.error('❌ Error fetching review updates:', updatesError);
    }
    
    console.log('📸 Found review updates with media:', reviewUpdates?.length || 0);
    
    // Combine all user IDs for profile lookup
    const allUserIds = [
      ...(reviews?.map(r => r.user_id) || []),
      ...(reviewUpdates?.map(u => u.user_id) || [])
    ];
    
    // Get user profiles for all users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', allUserIds);
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    }
    
    // Create a map of user profiles for quick lookup
    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile);
    });
    
    // Process reviews and extract media
    if (reviews && reviews.length > 0) {
      reviews.forEach((review: any) => {
        console.log('📸 Processing review:', review.id, 'media:', review.media);
        
        if (review.media && Array.isArray(review.media)) {
          review.media.forEach((media: MediaItem, index: number) => {
            if ((media.type === 'image' || media.type === 'video') && media.url) {
              const userProfile = profileMap.get(review.user_id);
              
              photos.push({
                ...media,
                id: `review-${review.id}-${index}`,
                source: 'user_review',
                reviewId: review.id,
                reviewTitle: review.title,
                username: userProfile?.username || 'Anonymous',
                createdAt: review.created_at
              });
              
              console.log('📸 Added review media:', media.url);
            }
          });
        }
      });
    }
    
    // Process review updates and extract media
    if (reviewUpdates && reviewUpdates.length > 0) {
      reviewUpdates.forEach((update: any) => {
        console.log('📸 Processing review update:', update.id, 'media:', update.media);
        
        if (update.media && Array.isArray(update.media)) {
          update.media.forEach((media: MediaItem, index: number) => {
            if ((media.type === 'image' || media.type === 'video') && media.url) {
              const userProfile = profileMap.get(update.user_id);
              
              photos.push({
                ...media,
                id: `review-update-${update.id}-${index}`,
                source: 'user_review',
                reviewId: update.review_id,
                reviewTitle: update.reviews?.title || 'Timeline Update',
                username: userProfile?.username || 'Anonymous',
                createdAt: update.created_at,
                isTimelineUpdate: true,
                timelineComment: update.comment
              });
              
              console.log('📸 Added timeline update photo:', media.url);
            }
          });
        }
      });
    }
  } catch (error) {
    console.error('❌ Error fetching review media:', error);
  }
  
  console.log('📸 Total review photos found:', photos.length);
  return photos;
};

/**
 * Report a photo
 */
export const reportPhoto = async (
  photoUrl: string,
  photoSource: string,
  entityId: string,
  reviewId: string | undefined,
  reason: string,
  description?: string
) => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Insert the report
    const { error: reportError } = await supabase
      .from('photo_reports')
      .insert({
        user_id: user.id,
        photo_url: photoUrl,
        photo_source: photoSource,
        entity_id: entityId,
        review_id: reviewId || null,
        reason,
        description
      });
    
    if (reportError) {
      throw reportError;
    }

    // Update the entity photo's moderation status to pending
    if (photoSource === 'entity_photo') {
      const { error: updateError } = await supabase
        .from('entity_photos')
        .update({ moderation_status: 'pending' })
        .eq('url', photoUrl);
      
      if (updateError) {
        console.error('Error updating photo moderation status:', updateError);
        // Don't throw here as the report was successful
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error reporting photo:', error);
    throw error;
  }
};