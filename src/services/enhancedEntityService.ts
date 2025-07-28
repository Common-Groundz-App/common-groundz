
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { saveExternalImageToStorage } from '@/utils/imageUtils';

export interface EnhancedEntityData {
  name: string;
  type: string;
  venue?: string;
  description?: string;
  image_url?: string;
  api_source?: string;
  api_ref?: string;
  website_url?: string;
  metadata: any;
  
  // Enhanced fields
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

/**
 * Enhanced entity creation with comprehensive metadata extraction
 */
export const createEnhancedEntity = async (rawData: any, entityType: string): Promise<Entity | null> => {
  try {
    console.log('🔧 Creating enhanced entity from raw data:', rawData);
    
    // Extract enhanced metadata based on entity type
    const enhancedData = await extractEnhancedMetadata(rawData, entityType);
    
    // Create entity first WITHOUT the image to get the actual entity ID
    const { data: entity, error } = await supabase
      .from('entities')
      .insert({
        name: enhancedData.name,
        type: entityType as any,
        venue: enhancedData.venue,
        description: enhancedData.description,
        image_url: enhancedData.image_url, // Keep original external URL temporarily
        api_source: enhancedData.api_source,
        api_ref: enhancedData.api_ref,
        website_url: enhancedData.website_url,
        metadata: enhancedData.metadata,
        authors: enhancedData.authors,
        publication_year: enhancedData.publication_year,
        isbn: enhancedData.isbn,
        languages: enhancedData.languages,
        external_ratings: enhancedData.external_ratings,
        price_info: enhancedData.price_info,
        specifications: enhancedData.specifications,
        cast_crew: enhancedData.cast_crew,
        ingredients: enhancedData.ingredients,
        nutritional_info: enhancedData.nutritional_info,
        last_enriched_at: new Date().toISOString(),
        enrichment_source: enhancedData.api_source,
        data_quality_score: calculateDataQualityScore(enhancedData),
        slug: generateSlug(enhancedData.name)
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating enhanced entity:', error);
      return null;
    }
    
    console.log('✅ Entity created with ID:', entity.id);
    
    // Now save image locally using the actual entity ID
    if (enhancedData.image_url) {
      console.log('🖼️ Saving image to local storage for entity:', entity.id);
      const savedImageUrl = await saveExternalImageToStorage(enhancedData.image_url, entity.id);
      
      if (savedImageUrl && savedImageUrl !== enhancedData.image_url) {
        // Update entity with local image URL
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: savedImageUrl })
          .eq('id', entity.id);
        
        if (updateError) {
          console.error('⚠️ Failed to update entity with local image URL:', updateError);
        } else {
          console.log('✅ Entity image updated to local storage:', savedImageUrl);
          entity.image_url = savedImageUrl;
        }
      }
    }
    
    console.log('✅ Enhanced entity created successfully:', entity);
    return entity as Entity;
  } catch (error) {
    console.error('❌ Error in createEnhancedEntity:', error);
    return null;
  }
};

/**
 * Extract comprehensive metadata based on entity type
 */
const extractEnhancedMetadata = async (rawData: any, entityType: string): Promise<EnhancedEntityData> => {
  const baseData: EnhancedEntityData = {
    name: rawData.name || rawData.title || '',
    type: entityType,
    venue: rawData.venue,
    description: rawData.description,
    image_url: rawData.image_url,
    api_source: rawData.api_source,
    api_ref: rawData.api_ref,
    website_url: rawData.website_url,
    metadata: rawData.metadata || {}
  };
  
  switch (entityType) {
    case 'book':
      return extractBookMetadata(rawData, baseData);
    case 'movie':
      return extractMovieMetadata(rawData, baseData);
    case 'place':
      return await extractPlaceMetadata(rawData, baseData);
    case 'food':
      return extractFoodMetadata(rawData, baseData);
    case 'product':
      return extractProductMetadata(rawData, baseData);
    default:
      return baseData;
  }
};

/**
 * Extract book-specific metadata
 */
const extractBookMetadata = (rawData: any, baseData: EnhancedEntityData): EnhancedEntityData => {
  const metadata = rawData.metadata || {};
  
  // Extract authors from multiple possible locations
  const authors = extractAuthors(rawData);
  
  // Extract publication year
  const publicationYear = extractPublicationYear(rawData);
  
  // Extract ISBN
  const isbn = extractISBN(rawData);
  
  // Extract languages
  const languages = extractLanguages(rawData);
  
  return {
    ...baseData,
    authors: authors,
    publication_year: publicationYear,
    isbn: isbn,
    languages: languages,
    external_ratings: {
      goodreads: metadata.goodreads_rating,
      amazon: metadata.amazon_rating,
      openlibrary: metadata.ratings_average || metadata.rating_average,
      rating_count: metadata.ratings_count || metadata.rating_count
    },
    specifications: {
      page_count: metadata.page_count || metadata.number_of_pages_median,
      publisher: metadata.publisher,
      publish_date: metadata.publish_date,
      format: metadata.format,
      series: metadata.series,
      volume: metadata.volume,
      edition_count: metadata.edition_count,
      subjects: metadata.subjects
    }
  };
};

/**
 * Extract movie-specific metadata
 */
const extractMovieMetadata = (rawData: any, baseData: EnhancedEntityData): EnhancedEntityData => {
  const metadata = rawData.metadata || {};
  
  return {
    ...baseData,
    publication_year: extractReleaseYear(rawData),
    languages: extractLanguages(rawData),
    external_ratings: {
      imdb: metadata.imdb_rating || metadata.imdbRating,
      tmdb: metadata.vote_average,
      rotten_tomatoes: metadata.rotten_tomatoes,
      metacritic: metadata.metascore || metadata.metacritic_score,
      imdb_votes: metadata.imdb_votes || metadata.imdbVotes
    },
    cast_crew: {
      director: metadata.director,
      cast: metadata.cast || (metadata.actors ? metadata.actors.split(', ') : []),
      crew: metadata.crew,
      producer: metadata.producer,
      writer: metadata.writer
    },
    specifications: {
      runtime: metadata.runtime,
      budget: metadata.budget,
      revenue: metadata.revenue,
      genres: metadata.genres || (metadata.genre ? metadata.genre.split(', ') : []),
      production_companies: metadata.production_companies,
      countries: metadata.countries || (metadata.country ? metadata.country.split(', ') : []),
      rated: metadata.rated,
      box_office: metadata.box_office,
      awards: metadata.awards
    }
  };
};

/**
 * Extract place-specific metadata with enriched Google Places data
 */
const extractPlaceMetadata = async (rawData: any, baseData: EnhancedEntityData): Promise<EnhancedEntityData> => {
  const metadata = rawData.metadata || {};
  let enrichedMetadata = { ...metadata };
  
  // Try to enrich with search-places-deep for multiple photos and detailed data
  if (baseData.name && !metadata.photo_references) {
    try {
      console.log(`🔍 Enriching place metadata for "${baseData.name}" using search-places-deep`);
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('search-places-deep', {
        body: { query: baseData.name }
      });

      if (!error && data?.length > 0) {
        const enrichedPlace = data[0]; // Use first match
        console.log(`✅ Enriched place data found with ${enrichedPlace.metadata?.photo_references?.length || 0} photos`);
        
        // Merge enriched metadata with existing data
        enrichedMetadata = {
          ...metadata,
          ...enrichedPlace.metadata,
          // Preserve any existing metadata that might be more specific
          place_id: metadata.place_id || enrichedPlace.metadata?.place_id,
          formatted_address: metadata.formatted_address || enrichedPlace.metadata?.formatted_address,
        };
        
        // Update base data with enriched information
        if (!baseData.image_url && enrichedPlace.image_url) {
          baseData.image_url = enrichedPlace.image_url;
        }
      } else {
        console.log(`⚠️ No enriched place data found for "${baseData.name}"`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to enrich place metadata with search-places-deep:', error);
    }
  }
  
  return {
    ...baseData,
    metadata: enrichedMetadata,
    external_ratings: {
      google_rating: enrichedMetadata.rating,
      user_ratings_total: enrichedMetadata.user_ratings_total,
      price_level: enrichedMetadata.price_level
    },
    specifications: {
      place_id: enrichedMetadata.place_id,
      address: enrichedMetadata.formatted_address,
      phone: enrichedMetadata.formatted_phone_number,
      website: enrichedMetadata.website,
      hours: enrichedMetadata.opening_hours,
      types: enrichedMetadata.types,
      location: enrichedMetadata.geometry?.location
    }
  };
};

/**
 * Extract food-specific metadata
 */
const extractFoodMetadata = (rawData: any, baseData: EnhancedEntityData): EnhancedEntityData => {
  const metadata = rawData.metadata || {};
  
  return {
    ...baseData,
    ingredients: extractIngredients(rawData),
    nutritional_info: {
      calories: metadata.calories,
      protein: metadata.protein,
      carbohydrates: metadata.carbs,
      fat: metadata.fat,
      fiber: metadata.fiber,
      sugar: metadata.sugar,
      sodium: metadata.sodium,
      allergens: metadata.allergens
    },
    specifications: {
      cuisine_type: metadata.cuisine,
      dietary_restrictions: metadata.dietary_restrictions,
      spice_level: metadata.spice_level,
      cooking_time: metadata.cooking_time,
      difficulty: metadata.difficulty
    }
  };
};

/**
 * Extract product-specific metadata
 */
const extractProductMetadata = (rawData: any, baseData: EnhancedEntityData): EnhancedEntityData => {
  const metadata = rawData.metadata || {};
  
  return {
    ...baseData,
    price_info: {
      price: metadata.price,
      currency: metadata.currency,
      original_price: metadata.original_price,
      discount: metadata.discount,
      availability: metadata.availability
    },
    external_ratings: {
      rating: metadata.rating,
      review_count: metadata.review_count,
      seller_rating: metadata.seller_rating
    },
    specifications: {
      brand: metadata.brand,
      model: metadata.model,
      category: metadata.category,
      dimensions: metadata.dimensions,
      weight: metadata.weight,
      color: metadata.color,
      material: metadata.material,
      warranty: metadata.warranty
    }
  };
};

// Helper functions for metadata extraction
const extractAuthors = (rawData: any): string[] => {
  // Try multiple possible locations for authors
  if (rawData.authors && Array.isArray(rawData.authors)) {
    return rawData.authors.map((a: any) => typeof a === 'string' ? a : a.name || a.author);
  }
  
  if (rawData.metadata?.authors && Array.isArray(rawData.metadata.authors)) {
    return rawData.metadata.authors.map((a: any) => typeof a === 'string' ? a : a.name || a.author);
  }
  
  if (rawData.venue && rawData.api_source === 'openlibrary') {
    // For books, venue often contains author names
    return [rawData.venue];
  }
  
  if (typeof rawData.authors === 'string') return [rawData.authors];
  if (typeof rawData.metadata?.authors === 'string') return [rawData.metadata.authors];
  
  return [];
};

const extractPublicationYear = (rawData: any): number | undefined => {
  // Try multiple fields for publication year
  const sources = [
    rawData.publication_year,
    rawData.metadata?.publication_year,
    rawData.metadata?.publish_year,
    rawData.metadata?.first_publish_year,
    rawData.year,
    rawData.metadata?.year
  ];
  
  for (const source of sources) {
    if (typeof source === 'number' && source > 0) {
      return source;
    }
    if (typeof source === 'string') {
      const match = source.match(/\d{4}/);
      if (match) {
        return parseInt(match[0]);
      }
    }
  }
  
  return undefined;
};

const extractReleaseYear = (rawData: any): number | undefined => {
  const sources = [
    rawData.release_date,
    rawData.metadata?.release_date,
    rawData.metadata?.year,
    rawData.year,
    rawData.publication_year
  ];
  
  for (const source of sources) {
    if (typeof source === 'number' && source > 0) {
      return source;
    }
    if (typeof source === 'string') {
      const match = source.match(/\d{4}/);
      if (match) {
        return parseInt(match[0]);
      }
    }
  }
  
  return undefined;
};

const extractISBN = (rawData: any): string | undefined => {
  return rawData.isbn || rawData.metadata?.isbn || rawData.metadata?.isbn_13 || rawData.metadata?.isbn_10;
};

const extractLanguages = (rawData: any): string[] => {
  const sources = [
    rawData.languages,
    rawData.metadata?.languages,
    rawData.metadata?.language
  ];
  
  for (const source of sources) {
    if (Array.isArray(source)) {
      return source.map(lang => typeof lang === 'string' ? lang : lang.name || lang.english_name || String(lang));
    }
    if (typeof source === 'string') {
      return [source];
    }
  }
  
  return [];
};

const extractIngredients = (rawData: any): string[] => {
  const ingredients = rawData.ingredients || rawData.metadata?.ingredients || [];
  if (typeof ingredients === 'string') return ingredients.split(',').map(i => i.trim());
  return Array.isArray(ingredients) ? ingredients : [];
};

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');
};

const calculateDataQualityScore = (data: EnhancedEntityData): number => {
  let score = 0;
  
  // Base fields
  if (data.name) score += 10;
  if (data.description) score += 15;
  if (data.image_url) score += 10;
  
  // Enhanced fields
  if (data.authors?.length) score += 10;
  if (data.publication_year) score += 5;
  if (data.isbn) score += 10;
  if (data.languages?.length) score += 5;
  if (data.external_ratings && Object.keys(data.external_ratings).length > 0) score += 15;
  if (data.specifications && Object.keys(data.specifications).length > 0) score += 10;
  if (data.cast_crew && Object.keys(data.cast_crew).length > 0) score += 10;
  if (data.ingredients?.length) score += 5;
  
  return Math.min(score, 100);
};

/**
 * Queue entity for background enrichment
 */
export const queueEntityForEnrichment = async (entityId: string, priority: number = 5): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('entity_enrichment_queue')
      .insert({
        entity_id: entityId,
        priority,
        status: 'pending'
      });
    
    return !error;
  } catch (error) {
    console.error('Error queuing entity for enrichment:', error);
    return false;
  }
};
