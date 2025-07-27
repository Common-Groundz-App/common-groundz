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
    console.log('🖼️ Fetching Google Places photos for entity:', entity.name);
    console.log('🖼️ Entity photo_reference:', entity.photo_reference);
    console.log('🖼️ Entity metadata photo_reference:', entity.metadata?.photo_reference);
    console.log('🖼️ Entity metadata photos array:', entity.metadata?.photos);
    
    // Get photo reference from either top-level or metadata
    const primaryPhotoRef = entity.photo_reference || entity.metadata?.photo_reference;
    
    if (primaryPhotoRef) {
      const photoUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/get-google-places-photo?photoReference=${primaryPhotoRef}&maxWidth=800`;
      
      photos.push({
        id: `google-places-${entity.id}`,
        url: photoUrl,
        type: 'image',
        alt: entity.name,
        order: 0,
        source: 'google_places'
      });
      
      console.log('🖼️ Added primary Google Places photo:', photoUrl);
    }
    
    // Check for additional photos in metadata.photos array
    if (entity.metadata?.photos && Array.isArray(entity.metadata.photos)) {
      console.log('🖼️ Processing additional photos from metadata.photos array...');
      entity.metadata.photos.slice(0, 10).forEach((photo: any, index: number) => {
        if (photo.photo_reference && photo.photo_reference !== primaryPhotoRef) {
          const photoUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/get-google-places-photo?photoReference=${photo.photo_reference}&maxWidth=800`;
          
          photos.push({
            id: `google-places-${entity.id}-${index}`,
            url: photoUrl,
            type: 'image',
            alt: entity.name,
            order: index + 1,
            source: 'google_places'
          });
          
          console.log('🖼️ Added additional Google Places photo:', photoUrl);
        }
      });
    } else {
      console.log('🖼️ No additional photos found in metadata.photos array');
    }
  } catch (error) {
    console.error('❌ Error fetching Google Places photos:', error);
  }
  
  console.log('🖼️ Total Google Places photos found:', photos.length);
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