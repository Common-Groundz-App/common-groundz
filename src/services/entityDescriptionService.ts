import { supabase } from '@/integrations/supabase/client';

export interface EntityDescriptionBackfillResult {
  success: boolean;
  processed: number;
  stats: {
    user_brand: number;
    google_editorial: number;
    auto_generated: number;
    address_fallback: number;
    errors: number;
  };
  entities: Array<{
    id: string;
    name: string;
    status: string;
    source?: string;
  }>;
}

/**
 * Triggers the backfill process for entity descriptions
 * This calls the edge function that processes Google Places entities
 * and adds proper descriptions with source attribution
 */
export const triggerEntityDescriptionBackfill = async (): Promise<EntityDescriptionBackfillResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('backfill-entity-descriptions');

    if (error) {
      console.error('Error calling backfill function:', error);
      throw new Error(`Backfill failed: ${error.message}`);
    }

    return data as EntityDescriptionBackfillResult;
  } catch (error) {
    console.error('Error in triggerEntityDescriptionBackfill:', error);
    throw error;
  }
};

/**
 * Refreshes a single Google Places entity with latest data
 * This calls the enhanced refresh function that includes description processing
 */
export const refreshGooglePlacesEntity = async (entityId: string, placeId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('refresh-google-places-entity', {
      body: { entityId, placeId }
    });

    if (error) {
      console.error('Error refreshing Google Places entity:', error);
      throw new Error(`Refresh failed: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in refreshGooglePlacesEntity:', error);
    throw error;
  }
};

/**
 * Gets entities that need description backfill
 */
export const getEntitiesNeedingDescriptionBackfill = async () => {
  try {
    const { data, error } = await supabase
      .from('entities')
      .select('id, name, description, about_source, api_source, api_ref')
      .eq('api_source', 'google_places')
      .or('description.is.null,about_source.is.null')
      .eq('is_deleted', false)
      .limit(100);

    if (error) {
      console.error('Error fetching entities needing backfill:', error);
      throw new Error(`Failed to fetch entities: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEntitiesNeedingDescriptionBackfill:', error);
    throw error;
  }
};