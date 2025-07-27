import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

interface PhotoWithMetadata extends MediaItem {
  source: 'google_places' | 'user_review';
  reviewId?: string;
  reviewTitle?: string;
  username?: string;
  createdAt?: string;
}

/**
 * Fetch Google Places photos for an entity
 */
export const fetchGooglePlacesPhotos = async (entity: Entity): Promise<PhotoWithMetadata[]> => {
  const photos: PhotoWithMetadata[] = [];
  
  try {
    // Check if entity has Google Places photo reference
    if (entity.photo_reference) {
      const photoUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/get-google-places-photo?photoReference=${entity.photo_reference}&maxWidth=800`;
      
      photos.push({
        id: `google-places-${entity.id}`,
        url: photoUrl,
        type: 'image',
        alt: entity.name,
        order: 0,
        source: 'google_places'
      });
    }
    
    // Check for additional photos in metadata
    if (entity.metadata?.photos && Array.isArray(entity.metadata.photos)) {
      entity.metadata.photos.slice(0, 10).forEach((photo: any, index: number) => {
        if (photo.photo_reference && photo.photo_reference !== entity.photo_reference) {
          const photoUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/get-google-places-photo?photoReference=${photo.photo_reference}&maxWidth=800`;
          
          photos.push({
            id: `google-places-${entity.id}-${index}`,
            url: photoUrl,
            type: 'image',
            alt: entity.name,
            order: index + 1,
            source: 'google_places'
          });
        }
      });
    }
  } catch (error) {
    console.error('Error fetching Google Places photos:', error);
  }
  
  return photos;
};

/**
 * Fetch review media for an entity
 */
export const fetchEntityReviewMedia = async (entityId: string): Promise<PhotoWithMetadata[]> => {
  const photos: PhotoWithMetadata[] = [];
  
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        title,
        media,
        created_at,
        profiles:user_id (username)
      `)
      .eq('entity_id', entityId)
      .eq('status', 'published')
      .not('media', 'is', null);
    
    if (error) {
      console.error('Error fetching review media:', error);
      return photos;
    }
    
    reviews?.forEach((review: any) => {
      if (review.media && Array.isArray(review.media)) {
        review.media.forEach((media: MediaItem, index: number) => {
          if (media.type === 'image' && media.url) {
            photos.push({
              ...media,
              id: `review-${review.id}-${index}`,
              source: 'user_review',
              reviewId: review.id,
              reviewTitle: review.title,
              username: review.profiles?.username,
              createdAt: review.created_at
            });
          }
        });
      }
    });
  } catch (error) {
    console.error('Error fetching review media:', error);
  }
  
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