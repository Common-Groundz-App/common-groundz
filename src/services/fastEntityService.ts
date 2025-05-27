
import { supabase } from '@/integrations/supabase/client';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { generateSlug } from '@/utils/slugUtils';

export interface FastEntityData {
  name: string;
  type: EntityTypeString;
  venue?: string;
  description?: string;
  api_source?: string;
  api_ref?: string;
  metadata?: any;
}

export interface EntityCreationResult {
  entity: any;
  backgroundTaskId?: string;
}

/**
 * Creates an entity immediately with minimal data for fast user experience.
 * Heavy operations like image processing are queued for background processing.
 */
export const createEntityFast = async (data: FastEntityData): Promise<EntityCreationResult | null> => {
  try {
    console.log('🚀 Fast entity creation started:', data.name);
    
    // Create entity with minimal required data immediately
    const entityData = {
      name: data.name,
      type: data.type as any,
      venue: data.venue,
      description: data.description,
      api_source: data.api_source,
      api_ref: data.api_ref,
      metadata: data.metadata || {},
      image_url: getEntityTypeFallbackImage(data.type), // Use fallback image initially
      slug: generateSlug(data.name),
      data_quality_score: calculateBasicQualityScore(data),
      is_deleted: false
    };

    // Insert entity immediately
    const { data: entity, error } = await supabase
      .from('entities')
      .insert(entityData)
      .select()
      .single();

    if (error) {
      console.error('❌ Fast entity creation failed:', error);
      return null;
    }

    console.log('✅ Entity created fast:', entity.id);

    // Queue background processing if there's external data to process
    let backgroundTaskId: string | undefined;
    if (data.api_source && data.api_ref) {
      backgroundTaskId = await queueBackgroundProcessing(entity.id, data);
    }

    return {
      entity,
      backgroundTaskId
    };
  } catch (error) {
    console.error('❌ Error in fast entity creation:', error);
    return null;
  }
};

/**
 * Queue background processing for heavy operations
 */
const queueBackgroundProcessing = async (entityId: string, data: FastEntityData): Promise<string | undefined> => {
  try {
    // Insert into background processing queue
    const { data: task, error } = await supabase
      .from('entity_enrichment_queue')
      .insert({
        entity_id: entityId,
        status: 'pending',
        priority: 1, // High priority for user-initiated creation
        metadata: {
          operation: 'enhance_entity',
          original_data: data,
          tasks: ['image_processing', 'metadata_enrichment']
        }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to queue background processing:', error);
      return undefined;
    }

    console.log('🔄 Background processing queued:', task.id);
    return task.id;
  } catch (error) {
    console.error('❌ Error queuing background processing:', error);
    return undefined;
  }
};

/**
 * Calculate basic quality score for immediate entity creation
 */
const calculateBasicQualityScore = (data: FastEntityData): number => {
  let score = 0;
  
  if (data.name) score += 20;
  if (data.description) score += 15;
  if (data.venue) score += 10;
  if (data.api_source) score += 15;
  if (data.api_ref) score += 10;
  if (data.metadata && Object.keys(data.metadata).length > 0) score += 10;
  
  return Math.min(score, 80); // Cap at 80 since we haven't done full processing yet
};

/**
 * Get entity processing status
 */
export const getEntityProcessingStatus = async (entityId: string) => {
  try {
    const { data, error } = await supabase
      .from('entity_enrichment_queue')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error getting processing status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getEntityProcessingStatus:', error);
    return null;
  }
};
