
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './types';
import { mapStringToEntityType } from '@/hooks/feed/api/types';

export const createRecommendation = async (recommendation: Omit<Recommendation, 'id' | 'created_at' | 'updated_at'>) => {
  // Convert recommendation data for database compatibility
  const dbRecommendation: any = {
    ...recommendation,
    // Convert category to string if needed - this will help with type compatibility
    category: recommendation.category.toString().toLowerCase()
  };

  const { data, error } = await supabase
    .from('recommendations')
    .insert(dbRecommendation)
    .select()
    .single();

  if (error) {
    console.error('Error creating recommendation:', error);
    throw error;
  }

  return data;
};

export const updateRecommendation = async (id: string, updates: Partial<Recommendation>) => {
  // Convert recommendation data for database compatibility
  const dbUpdates: any = {
    ...updates
  };

  // If category is being updated, ensure it's in the right format
  if (updates.category) {
    dbUpdates.category = updates.category.toString().toLowerCase();
  }

  const { data, error } = await supabase
    .from('recommendations')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recommendation:', error);
    throw error;
  }

  return data;
};

export const deleteRecommendation = async (id: string) => {
  const { error } = await supabase
    .from('recommendations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting recommendation:', error);
    throw error;
  }

  return true;
};

export const incrementViewCount = async (id: string, viewerId: string | null) => {
  try {
    await supabase.rpc('increment_recommendation_view', {
      rec_id: id,
      viewer_id: viewerId
    });
    return true;
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return false;
  }
};
