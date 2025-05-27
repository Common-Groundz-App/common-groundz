
import { supabase } from '@/integrations/supabase/client';
import { downloadAndStoreImage } from './imageStorageService';

interface EnhancedEntityData {
  id?: string;
  name: string;
  type: string;
  description?: string;
  image_url?: string;
  api_source?: string;
  api_ref?: string;
  venue?: string;
  metadata?: any;
  authors?: string[];
  publication_year?: number;
  isbn?: string;
  languages?: string[];
  external_ratings?: any;
  price_info?: any;
  specifications?: any;
  cast_crew?: any;
  ingredients?: string[];
  nutritional_info?: any;
}

export const createOrUpdateEnhancedEntity = async (
  entityData: EnhancedEntityData,
  userId: string
): Promise<any> => {
  try {
    console.log('🚀 Creating/updating enhanced entity:', entityData);

    // First, check if entity exists by api_ref and api_source
    let existingEntity = null;
    if (entityData.api_ref && entityData.api_source) {
      const { data } = await supabase
        .from('entities')
        .select('*')
        .eq('api_ref', entityData.api_ref)
        .eq('api_source', entityData.api_source)
        .eq('is_deleted', false)
        .single();
      
      existingEntity = data;
    }

    let finalImageUrl = entityData.image_url;
    let entityId = existingEntity?.id;

    // Ensure the type is properly typed for the database
    const validTypes = ['book', 'movie', 'place', 'product', 'food'] as const;
    const entityType = validTypes.includes(entityData.type as any) ? entityData.type as typeof validTypes[number] : 'product';

    // If this is a new entity or we're updating an existing one
    if (!existingEntity) {
      // Create new entity first to get ID
      const { data: newEntity, error: createError } = await supabase
        .from('entities')
        .insert({
          name: entityData.name,
          type: entityType,
          description: entityData.description,
          api_source: entityData.api_source,
          api_ref: entityData.api_ref,
          venue: entityData.venue,
          metadata: entityData.metadata || {},
          created_by: userId,
          image_url: entityData.image_url, // Temporary, will be updated below
          last_enriched_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      entityId = newEntity.id;
      
      console.log('✅ Created new entity:', entityId);
    } else {
      // Update existing entity with new data
      const { error: updateError } = await supabase
        .from('entities')
        .update({
          name: entityData.name,
          description: entityData.description,
          metadata: entityData.metadata || {},
          last_enriched_at: new Date().toISOString()
        })
        .eq('id', entityId);

      if (updateError) throw updateError;
      
      console.log('✅ Updated existing entity:', entityId);
    }

    // Download and store image locally in background (don't wait for this)
    if (entityData.image_url && !entityData.image_url.includes('supabase')) {
      const imagePromise = downloadAndStoreImage(entityData.image_url, entityId)
        .then(result => {
          if (result.success && result.localUrl) {
            // Update entity with local image URL
            return supabase
              .from('entities')
              .update({ image_url: result.localUrl })
              .eq('id', entityId)
              .then(() => console.log('📸 Updated entity with local image'));
          }
        });
      
      // Handle promise properly
      imagePromise.catch(err => console.error('Background image download failed:', err));
    }

    // Track view
    await trackEntityView(entityId, userId);

    // Get final entity data
    const { data: finalEntity, error: fetchError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', entityId)
      .single();

    if (fetchError) throw fetchError;

    return finalEntity;
  } catch (error) {
    console.error('❌ Enhanced entity creation failed:', error);
    throw error;
  }
};

export const trackEntityView = async (entityId: string, userId?: string): Promise<void> => {
  try {
    // Use direct SQL insert since entity_views table is not in the generated types yet
    const { error } = await supabase.rpc('execute_sql', {
      query: `
        INSERT INTO entity_views (entity_id, user_id, session_id)
        VALUES ($1, $2, $3)
      `,
      params: [entityId, userId, Math.random().toString(36).substring(7)]
    });

    if (error) {
      console.warn('Failed to track entity view:', error);
    }

    // Update popularity score using a simpler approach
    const { error: popularityError } = await supabase.rpc('execute_sql', {
      query: `
        UPDATE entities 
        SET popularity_score = COALESCE(popularity_score, 0) + 0.1
        WHERE id = $1
      `,
      params: [entityId]
    });

    if (popularityError) {
      console.warn('Failed to update popularity:', popularityError);
    }
  } catch (error) {
    console.warn('Entity view tracking failed:', error);
  }
};

export const enrichEntityWithSearchData = (searchResult: any): EnhancedEntityData => {
  const baseData: EnhancedEntityData = {
    name: searchResult.name || searchResult.title,
    type: determineEntityType(searchResult),
    description: searchResult.description,
    image_url: searchResult.image_url,
    api_source: searchResult.api_source,
    api_ref: searchResult.api_ref,
    venue: searchResult.venue,
    metadata: searchResult.metadata || {}
  };

  // Enrich based on API source
  switch (searchResult.api_source) {
    case 'openlibrary':
      return {
        ...baseData,
        authors: searchResult.metadata?.authors || [],
        publication_year: searchResult.metadata?.first_publish_year,
        isbn: searchResult.metadata?.isbn?.[0],
        languages: searchResult.metadata?.languages || [],
        external_ratings: {
          goodreads: searchResult.metadata?.ratings_average,
          want_to_read: searchResult.metadata?.want_to_read_count,
          currently_reading: searchResult.metadata?.currently_reading_count
        }
      };

    case 'tmdb':
      return {
        ...baseData,
        cast_crew: {
          cast: searchResult.metadata?.cast || [],
          crew: searchResult.metadata?.crew || [],
          director: searchResult.metadata?.director,
          actors: searchResult.metadata?.actors
        },
        external_ratings: {
          tmdb: searchResult.metadata?.vote_average,
          imdb: searchResult.metadata?.imdb_rating
        },
        specifications: {
          runtime: searchResult.metadata?.runtime,
          release_date: searchResult.metadata?.release_date,
          genres: searchResult.metadata?.genres,
          budget: searchResult.metadata?.budget,
          revenue: searchResult.metadata?.revenue
        }
      };

    case 'google_places':
      return {
        ...baseData,
        external_ratings: {
          google: searchResult.metadata?.rating,
          total_ratings: searchResult.metadata?.user_ratings_total
        },
        specifications: {
          place_types: searchResult.metadata?.types,
          business_status: searchResult.metadata?.business_status,
          price_level: searchResult.metadata?.price_level,
          opening_hours: searchResult.metadata?.opening_hours,
          phone: searchResult.metadata?.formatted_phone_number,
          website: searchResult.metadata?.website
        }
      };

    case 'spoonacular':
      return {
        ...baseData,
        ingredients: searchResult.metadata?.ingredients || [],
        nutritional_info: searchResult.metadata?.nutrition || {},
        specifications: {
          cook_time: searchResult.metadata?.readyInMinutes,
          servings: searchResult.metadata?.servings,
          dish_types: searchResult.metadata?.dishTypes,
          diets: searchResult.metadata?.diets,
          occasions: searchResult.metadata?.occasions
        }
      };

    default:
      return baseData;
  }
};

const determineEntityType = (searchResult: any): string => {
  if (searchResult.api_source === 'openlibrary') return 'book';
  if (searchResult.api_source === 'tmdb') return 'movie';
  if (searchResult.api_source === 'google_places') return 'place';
  if (searchResult.api_source === 'spoonacular') return 'food';
  return searchResult.type || 'product';
};
