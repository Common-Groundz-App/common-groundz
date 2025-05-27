import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { saveExternalImageToStorage } from '@/utils/imageUtils';
import { createEntityFast } from '@/services/fastEntityService';

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
 * Enhanced entity creation with fast initial creation and background processing
 */
export const createEnhancedEntity = async (rawData: any, entityType: string): Promise<Entity | null> => {
  try {
    console.log('🔧 Creating enhanced entity (fast approach):', rawData);
    
    // Use fast entity creation for immediate response
    const result = await createEntityFast({
      name: rawData.name || rawData.title || '',
      type: entityType as EntityTypeString,
      venue: rawData.venue,
      description: rawData.description,
      api_source: rawData.api_source,
      api_ref: rawData.api_ref,
      metadata: rawData.metadata || {}
    });

    if (!result) {
      console.error('❌ Enhanced entity creation failed');
      return null;
    }

    console.log('✅ Enhanced entity created fast:', result.entity);
    return result.entity as Entity;
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
      return extractPlaceMetadata(rawData, baseData);
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
  
  return {
    ...baseData,
    authors: extractAuthors(rawData),
    publication_year: extractPublicationYear(rawData),
    isbn: extractISBN(rawData),
    languages: extractLanguages(rawData),
    external_ratings: {
      goodreads: metadata.goodreads_rating,
      amazon: metadata.amazon_rating,
      openlibrary: metadata.rating_average,
      rating_count: metadata.rating_count
    },
    specifications: {
      page_count: metadata.page_count || metadata.number_of_pages,
      publisher: metadata.publisher,
      publish_date: metadata.publish_date,
      format: metadata.format,
      series: metadata.series,
      volume: metadata.volume
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
      imdb: metadata.imdb_rating,
      tmdb: metadata.vote_average,
      rotten_tomatoes: metadata.rotten_tomatoes,
      metacritic: metadata.metacritic_score
    },
    cast_crew: {
      director: metadata.director,
      cast: metadata.cast,
      crew: metadata.crew,
      producer: metadata.producer,
      writer: metadata.writer
    },
    specifications: {
      runtime: metadata.runtime,
      budget: metadata.budget,
      revenue: metadata.revenue,
      genres: metadata.genres,
      production_companies: metadata.production_companies,
      countries: metadata.production_countries
    }
  };
};

/**
 * Extract place-specific metadata
 */
const extractPlaceMetadata = (rawData: any, baseData: EnhancedEntityData): EnhancedEntityData => {
  const metadata = rawData.metadata || {};
  
  return {
    ...baseData,
    external_ratings: {
      google_rating: metadata.rating,
      user_ratings_total: metadata.user_ratings_total,
      price_level: metadata.price_level
    },
    specifications: {
      place_id: metadata.place_id,
      address: metadata.formatted_address,
      phone: metadata.formatted_phone_number,
      website: metadata.website,
      hours: metadata.opening_hours,
      types: metadata.types,
      location: metadata.geometry?.location
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
  const authors = rawData.authors || rawData.metadata?.authors || [];
  if (typeof authors === 'string') return [authors];
  if (Array.isArray(authors)) return authors.map((a: any) => typeof a === 'string' ? a : a.name || a.author);
  return [];
};

const extractPublicationYear = (rawData: any): number | undefined => {
  const year = rawData.publication_year || rawData.metadata?.publication_year || 
               rawData.metadata?.publish_date || rawData.year;
  if (typeof year === 'string') {
    const match = year.match(/\d{4}/);
    return match ? parseInt(match[0]) : undefined;
  }
  return typeof year === 'number' ? year : undefined;
};

const extractReleaseYear = (rawData: any): number | undefined => {
  const year = rawData.release_date || rawData.metadata?.release_date || rawData.year;
  if (typeof year === 'string') {
    const match = year.match(/\d{4}/);
    return match ? parseInt(match[0]) : undefined;
  }
  return typeof year === 'number' ? year : undefined;
};

const extractISBN = (rawData: any): string | undefined => {
  return rawData.isbn || rawData.metadata?.isbn || rawData.metadata?.isbn_13 || rawData.metadata?.isbn_10;
};

const extractLanguages = (rawData: any): string[] => {
  const languages = rawData.languages || rawData.metadata?.languages || [];
  if (typeof languages === 'string') return [languages];
  return Array.isArray(languages) ? languages : [];
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
