import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

export interface PhotoWithMetadata extends MediaItem {
  source: 'google_places' | 'user_review';
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
}

/**
 * Check if a URL is from a trusted source (Google Places edge function)
 */
const isTrustedSource = (url: string): boolean => {
  return url.includes('supabase.co/functions/v1/get-google-places-photo');
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

/**
 * Create a Google Places photo URL with better error handling
 */
const createGooglePlacesPhotoUrl = (photoReference: string, maxWidth: number = 800): string => {
  try {
    const baseUrl = 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/get-google-places-photo';
    const params = new URLSearchParams({
      photoReference,
      maxWidth: maxWidth.toString(),
      timestamp: Date.now().toString() // Add timestamp to prevent caching issues
    });
    return `${baseUrl}?${params.toString()}`;
  } catch (error) {
    console.error('❌ Error creating photo URL:', error);
    throw error;
  }
};

/**
 * Fetch Google Places photos for an entity with validation
 */
export const fetchGooglePlacesPhotos = async (entity: Entity): Promise<PhotoWithMetadata[]> => {
  const photos: PhotoWithMetadata[] = [];
  
  try {
    console.log('🖼️ Fetching Google Places photos for entity:', entity.name);
    console.log('🖼️ Entity photo_reference:', entity.photo_reference);
    console.log('🖼️ Entity metadata photo_reference:', entity.metadata?.photo_reference);
    console.log('🖼️ Entity metadata photos array:', entity.metadata?.photos);
    
    // Get photo reference from either top-level or metadata
    const primaryPhotoRef = entity.photo_reference || entity.metadata?.photo_reference;
    
    if (primaryPhotoRef) {
      try {
        const photoUrl = createGooglePlacesPhotoUrl(primaryPhotoRef, 800);
        console.log('🖼️ Generated primary photo URL:', photoUrl);
        
        // For Google Places photos, trust the edge function and add directly
        photos.push({
          id: `google-places-${entity.id}`,
          url: photoUrl,
          type: 'image' as const,
          alt: entity.name,
          order: 0,
          source: 'google_places' as const,
          isPrimary: true
        });
        console.log('✅ Added primary Google Places photo (trusted source)');
      } catch (error) {
        console.error('❌ Error processing primary photo:', error);
      }
    }
    
    // Check for additional photos in metadata.photos array
    if (entity.metadata?.photos && Array.isArray(entity.metadata.photos)) {
      console.log('🖼️ Processing additional photos from metadata.photos array...');
      
      const additionalPhotos = entity.metadata.photos
        .slice(0, 10) // Limit to first 10 photos
        .filter((photo: any) => photo.photo_reference && photo.photo_reference !== primaryPhotoRef);
      
      console.log(`🖼️ Found ${additionalPhotos.length} additional photos to process`);
      
      // Process photos in parallel but limit concurrency
      const batchSize = 3;
      for (let i = 0; i < additionalPhotos.length; i += batchSize) {
        const batch = additionalPhotos.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (photo: any, batchIndex: number) => {
          const globalIndex = i + batchIndex;
          try {
            const photoUrl = createGooglePlacesPhotoUrl(photo.photo_reference, 800);
            console.log(`🖼️ Generated additional photo URL ${globalIndex + 1}:`, photoUrl);
            
            // For Google Places photos, trust the edge function and add directly
            return {
              id: `google-places-${entity.id}-${globalIndex}`,
              url: photoUrl,
              type: 'image' as const,
              alt: entity.name,
              order: globalIndex + 1,
              source: 'google_places' as const
            };
          } catch (error) {
            console.error(`❌ Error processing additional photo ${globalIndex + 1}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const validPhotos = batchResults.filter(photo => photo !== null);
        photos.push(...validPhotos);
        
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} processed: ${validPhotos.length} valid photos`);
      }
    } else {
      console.log('🖼️ No additional photos found in metadata.photos array');
    }
  } catch (error) {
    console.error('❌ Error fetching Google Places photos:', error);
  }
  
  console.log(`🖼️ Total valid Google Places photos: ${photos.length}`);
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
    
    if (!reviews || reviews.length === 0) {
      console.log('📸 No reviews with media found');
      return photos;
    }
    
    // Get user profiles for the reviews
    const userIds = reviews.map(r => r.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
    }
    
    // Create a map of user profiles for quick lookup
    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, profile);
    });
    
    // Process reviews and extract media
    reviews.forEach((review: any) => {
      console.log('📸 Processing review:', review.id, 'media:', review.media);
      
      if (review.media && Array.isArray(review.media)) {
        review.media.forEach((media: MediaItem, index: number) => {
          if (media.type === 'image' && media.url) {
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
            
            console.log('📸 Added review photo:', media.url);
          }
        });
      }
    });
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

    const { error } = await supabase
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
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error reporting photo:', error);
    throw error;
  }
};