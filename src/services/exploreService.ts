
import { supabase } from '@/integrations/supabase/client';

export interface PersonalizedEntity {
  entity_id: string;
  personalization_score: number;
  reason: string;
}

export interface EntityCollection {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  priority: number;
  entities?: any[];
}

export interface EntityView {
  entity_id: string;
  user_id?: string;
  session_id?: string;
  view_duration?: number;
  interaction_type?: string;
  metadata?: Record<string, any>;
}

// Valid entity types from the database schema
type EntityType = 'book' | 'movie' | 'place' | 'product' | 'food';

// Helper function to check if a string is a valid entity type
const isValidEntityType = (type: string): type is EntityType => {
  return ['book', 'movie', 'place', 'product', 'food'].includes(type);
};

// Track entity views for personalization
export const trackEntityView = async (entityView: EntityView) => {
  try {
    const { error } = await supabase
      .from('entity_views')
      .insert({
        entity_id: entityView.entity_id,
        user_id: entityView.user_id,
        session_id: entityView.session_id || crypto.randomUUID(),
        view_duration: entityView.view_duration || 0,
        interaction_type: entityView.interaction_type || 'view',
        metadata: entityView.metadata || {}
      });
    
    if (error) {
      console.error('Error tracking entity view:', error);
    }
  } catch (error) {
    console.error('Error tracking entity view:', error);
  }
};

// Update user interests based on interactions - using direct SQL instead of RPC
export const updateUserInterests = async (
  userId: string, 
  category: string, 
  entityType: string, 
  interactionStrength: number = 1
) => {
  try {
    // Use upsert with ON CONFLICT to update user interests
    const { error } = await supabase
      .from('user_interests')
      .upsert({
        user_id: userId,
        category,
        entity_type: entityType,
        interest_score: interactionStrength,
        last_interaction: new Date().toISOString(),
        interaction_count: 1
      }, {
        onConflict: 'user_id,category,entity_type'
      });
    
    if (error) {
      console.error('Error updating user interests:', error);
    }
  } catch (error) {
    console.error('Error updating user interests:', error);
  }
};

// Get personalized entities for a user
export const getPersonalizedEntities = async (userId: string, limit: number = 10): Promise<PersonalizedEntity[]> => {
  try {
    const { data, error } = await supabase.rpc('get_personalized_entities', {
      p_user_id: userId,
      p_limit: limit
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching personalized entities:', error);
    return [];
  }
};

// Get trending entities
export const getTrendingEntities = async (category?: string, limit: number = 10) => {
  try {
    let query = supabase
      .from('entities')
      .select(`
        id,
        name,
        type,
        description,
        image_url,
        venue,
        trending_score,
        recent_views_24h,
        recent_likes_24h,
        recent_recommendations_24h
      `)
      .eq('is_deleted', false)
      .order('trending_score', { ascending: false })
      .limit(limit);
    
    // Only filter by category if it's provided, not 'all', and is a valid entity type
    if (category && category !== 'all' && isValidEntityType(category)) {
      query = query.eq('type', category);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching trending entities:', error);
    return [];
  }
};

// Get themed collections
export const getEntityCollections = async () => {
  try {
    const { data, error } = await supabase
      .from('entity_collections')
      .select(`
        id,
        name,
        description,
        type,
        category,
        priority,
        metadata
      `)
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching entity collections:', error);
    return [];
  }
};

// Get entities for a specific collection
export const getCollectionEntities = async (collectionId: string, limit: number = 8) => {
  try {
    const { data, error } = await supabase
      .from('collection_entities')
      .select(`
        position,
        entities:entity_id (
          id,
          name,
          type,
          description,
          image_url,
          venue,
          trending_score
        )
      `)
      .eq('collection_id', collectionId)
      .order('position', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data?.map(item => item.entities).filter(Boolean) || [];
  } catch (error) {
    console.error('Error fetching collection entities:', error);
    return [];
  }
};

// Get hidden gems (high quality, low views)
export const getHiddenGems = async (category?: string, limit: number = 8) => {
  try {
    let query = supabase
      .from('entities')
      .select(`
        id,
        name,
        type,
        description,
        image_url,
        venue,
        recent_views_24h,
        popularity_score
      `)
      .eq('is_deleted', false)
      .lt('recent_views_24h', 10) // Low view count
      .order('popularity_score', { ascending: false })
      .limit(limit);
    
    // Only filter by category if it's provided, not 'all', and is a valid entity type
    if (category && category !== 'all' && isValidEntityType(category)) {
      query = query.eq('type', category);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching hidden gems:', error);
    return [];
  }
};

// Get new entities (recently added)
export const getNewEntities = async (category?: string, limit: number = 8) => {
  try {
    let query = supabase
      .from('entities')
      .select(`
        id,
        name,
        type,
        description,
        image_url,
        venue,
        created_at
      `)
      .eq('is_deleted', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Only filter by category if it's provided, not 'all', and is a valid entity type
    if (category && category !== 'all' && isValidEntityType(category)) {
      query = query.eq('type', category);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching new entities:', error);
    return [];
  }
};

// Calculate and update trending scores for all entities
export const updateTrendingScores = async () => {
  try {
    const { data: entities } = await supabase
      .from('entities')
      .select('id')
      .eq('is_deleted', false);
    
    if (entities) {
      for (const entity of entities) {
        await supabase.rpc('calculate_trending_score', {
          p_entity_id: entity.id
        });
      }
    }
  } catch (error) {
    console.error('Error updating trending scores:', error);
  }
};
