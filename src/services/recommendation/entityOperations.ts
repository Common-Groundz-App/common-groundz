import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from './types';
import { Database } from '@/integrations/supabase/types';

export const findOrCreateEntity = async (
  name: string,
  type: Database["public"]["Enums"]["entity_type"],
  venue?: string,
  imageUrl?: string,
  apiRef?: string,
  apiSource?: string,
  metadata?: Record<string, any>,
  description?: string,
  websiteUrl?: string,
  categoryId?: string,
  photoReference?: string,
  authors?: string[],
  publicationYear?: number,
  isbn?: string,
  languages?: string[],
  externalRatings?: Record<string, any>,
  priceInfo?: Record<string, any>,
  specifications?: Record<string, any>,
  castCrew?: Record<string, any>,
  ingredients?: string[],
  nutritionalInfo?: Record<string, any>
): Promise<Entity> => {
  try {
    // Check if an entity with the same name and type already exists
    let { data: existingEntity, error: selectError } = await supabase
      .from('entities')
      .select('*')
      .eq('name', name)
      .eq('type', type)
      .eq('is_deleted', false)
      .limit(1)
      .single();

    if (selectError) {
      console.error('Error checking for existing entity:', selectError);
      throw selectError;
    }

    if (existingEntity) {
      console.log('Entity already exists:', existingEntity);
      return {
        id: existingEntity.id,
        name: existingEntity.name,
        description: existingEntity.description,
        image_url: existingEntity.image_url,
        api_ref: existingEntity.api_ref,
        api_source: existingEntity.api_source,
        metadata: existingEntity.metadata ? (typeof existingEntity.metadata === 'string' ? JSON.parse(existingEntity.metadata) : existingEntity.metadata) : {},
        venue: existingEntity.venue,
        website_url: existingEntity.website_url,
        type: existingEntity.type as Database["public"]["Enums"]["entity_type"],
        slug: existingEntity.slug,
        category_id: existingEntity.category_id,
        popularity_score: existingEntity.popularity_score,
        photo_reference: existingEntity.photo_reference,
        created_at: existingEntity.created_at,
        updated_at: existingEntity.updated_at,
        authors: existingEntity.authors,
        publication_year: existingEntity.publication_year,
        isbn: existingEntity.isbn,
        languages: existingEntity.languages,
        external_ratings: existingEntity.external_ratings,
        price_info: existingEntity.price_info,
        specifications: existingEntity.specifications,
        cast_crew: existingEntity.cast_crew,
        ingredients: existingEntity.ingredients,
        nutritional_info: existingEntity.nutritional_info,
        last_enriched_at: existingEntity.last_enriched_at,
        enrichment_source: existingEntity.enrichment_source,
        data_quality_score: existingEntity.data_quality_score,
        parent_id: existingEntity.parent_id
      };
    }

    // If the entity doesn't exist, create a new one
    const { data: newEntity, error: insertError } = await supabase
      .from('entities')
      .insert([
        {
          name,
          type,
          venue,
          image_url: imageUrl,
          api_ref: apiRef,
          api_source: apiSource,
          metadata,
          description,
          website_url: websiteUrl,
          category_id: categoryId,
          photo_reference: photoReference,
          authors,
          publication_year: publicationYear,
          isbn,
          languages,
          external_ratings: externalRatings,
          price_info: priceInfo,
          specifications,
          cast_crew: castCrew,
          ingredients,
          nutritional_info: nutritionalInfo
        }
      ])
      .select('*')
      .limit(1)
      .single();

    if (insertError) {
      console.error('Error creating entity:', insertError);
      throw insertError;
    }

    if (!newEntity) {
      throw new Error('Failed to create new entity');
    }

    console.log('Entity created:', newEntity);
    return {
      id: newEntity.id,
      name: newEntity.name,
      description: newEntity.description,
      image_url: newEntity.image_url,
      api_ref: newEntity.api_ref,
      api_source: newEntity.api_source,
      metadata: newEntity.metadata ? (typeof newEntity.metadata === 'string' ? JSON.parse(newEntity.metadata) : newEntity.metadata) : {},
      venue: newEntity.venue,
      website_url: newEntity.website_url,
      type: newEntity.type as Database["public"]["Enums"]["entity_type"],
      slug: newEntity.slug,
      category_id: newEntity.category_id,
      popularity_score: newEntity.popularity_score,
      photo_reference: newEntity.photo_reference,
      created_at: newEntity.created_at,
      updated_at: newEntity.updated_at,
      authors: newEntity.authors,
      publication_year: newEntity.publication_year,
      isbn: newEntity.isbn,
      languages: newEntity.languages,
      external_ratings: newEntity.external_ratings,
      price_info: newEntity.price_info,
      specifications: newEntity.specifications,
      cast_crew: newEntity.cast_crew,
      ingredients: newEntity.ingredients,
      nutritional_info: newEntity.nutritional_info,
      last_enriched_at: newEntity.last_enriched_at,
      enrichment_source: newEntity.enrichment_source,
      data_quality_score: newEntity.data_quality_score,
      parent_id: newEntity.parent_id
    };
  } catch (error: any) {
    console.error('Error in findOrCreateEntity:', error);
    throw error;
  }
};

export const getEntitiesByType = async (type: Database["public"]["Enums"]["entity_type"]): Promise<Entity[]> => {
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('type', type)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error fetching entities by type:', error);
      throw error;
    }

    if (!data) {
      return [];
    }

    return data.map(entity => ({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      image_url: entity.image_url,
      api_ref: entity.api_ref,
      api_source: entity.api_source,
      metadata: entity.metadata ? (typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata) : {},
      venue: entity.venue,
      website_url: entity.website_url,
      type: entity.type as Database["public"]["Enums"]["entity_type"],
      slug: entity.slug,
      category_id: entity.category_id,
      popularity_score: entity.popularity_score,
      photo_reference: entity.photo_reference,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      authors: entity.authors,
      publication_year: entity.publication_year,
      isbn: entity.isbn,
      languages: entity.languages,
      external_ratings: entity.external_ratings,
      price_info: entity.price_info,
      specifications: entity.specifications,
      cast_crew: entity.cast_crew,
      ingredients: entity.ingredients,
      nutritional_info: entity.nutritional_info,
      last_enriched_at: entity.last_enriched_at,
      enrichment_source: entity.enrichment_source,
      data_quality_score: entity.data_quality_score,
      parent_id: entity.parent_id
    }));
  } catch (error) {
    console.error('Error in getEntitiesByType:', error);
    throw error;
  }
};

export const findEntityByApiRef = async (apiRef: string, apiSource: string): Promise<Entity | null> => {
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('api_ref', apiRef)
      .eq('api_source', apiSource)
      .eq('is_deleted', false)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No results found
        return null;
      }
      console.error('Error finding entity by API ref:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      api_ref: data.api_ref,
      api_source: data.api_source,
      metadata: data.metadata ? (typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata) : {},
      venue: data.venue,
      website_url: data.website_url,
      type: data.type as Database["public"]["Enums"]["entity_type"],
      slug: data.slug,
      category_id: data.category_id,
      popularity_score: data.popularity_score,
      photo_reference: data.photo_reference,
      created_at: data.created_at,
      updated_at: data.updated_at,
      authors: data.authors,
      publication_year: data.publication_year,
      isbn: data.isbn,
      languages: data.languages,
      external_ratings: data.external_ratings,
      price_info: data.price_info,
      specifications: data.specifications,
      cast_crew: data.cast_crew,
      ingredients: data.ingredients,
      nutritional_info: data.nutritional_info,
      last_enriched_at: data.last_enriched_at,
      enrichment_source: data.enrichment_source,
      data_quality_score: data.data_quality_score,
      parent_id: data.parent_id
    };
  } catch (error) {
    console.error('Error in findEntityByApiRef:', error);
    throw error;
  }
};
