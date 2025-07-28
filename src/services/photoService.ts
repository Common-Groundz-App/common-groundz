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

/**
 * Create a Google Places photo URL using proxy-google-image function
 */
const createGooglePlacesPhotoUrl = (photoReference: string, maxWidth: number = 400): string => {
  try {
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
        const photoUrl = createGooglePlacesPhotoUrl(primaryPhotoRef, 400);
        console.log('🖼️ Generated primary photo URL:', photoUrl);
        
        photos.push({
          id: `google-places-${entity.id}`,
          url: photoUrl,
          type: 'image' as const,
          alt: entity.name,
          order: 0,
          source: 'google_places' as const,
          originalReference: primaryPhotoRef,
          isPrimary: true
        });
        console.log('✅ Added primary Google Places photo');
      } catch (error) {
        console.error('❌ Error processing primary photo:', error);
      }
    } else {
      console.log('🖼️ No primary photo reference found');
    }
    
    // Check for additional photos in metadata.photos array
    if (entity.metadata?.photos && Array.isArray(entity.metadata.photos)) {
      console.log('🖼️ Processing additional photos from metadata.photos array...');
      
      const additionalPhotos = entity.metadata.photos
        .slice(0, 5) // Limit to first 5 additional photos
        .filter((photo: any) => photo.photo_reference && photo.photo_reference !== primaryPhotoRef);
      
      console.log(`🖼️ Found ${additionalPhotos.length} additional photos to process`);
      
      // Process photos sequentially to avoid overwhelming the API
      for (let i = 0; i < additionalPhotos.length; i++) {
        try {
          const photo = additionalPhotos[i];
          const photoUrl = createGooglePlacesPhotoUrl(photo.photo_reference, 400);
          console.log(`🖼️ Generated additional photo URL ${i + 1}:`, photoUrl);
          
          photos.push({
            id: `google-places-${entity.id}-${i}`,
            url: photoUrl,
            type: 'image' as const,
            alt: entity.name,
            order: i + 1,
            source: 'google_places' as const,
            originalReference: photo.photo_reference
          });
        } catch (error) {
          console.error(`❌ Error processing additional photo ${i + 1}:`, error);
        }
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