
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from '../recommendation/types';

export const createRecommendation = async (recommendationData: Partial<Recommendation> & { 
  title: string; 
  rating: number; 
  user_id: string;
  category: string;
}) => {
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .insert([recommendationData])
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating recommendation:', error);
    throw error;
  }
};

export const updateRecommendation = async (id: string, recommendationData: Partial<Recommendation>) => {
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .update(recommendationData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error updating recommendation:', error);
    throw error;
  }
};

export const deleteRecommendation = async (id: string) => {
  try {
    const { error } = await supabase
      .from('recommendations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    throw error;
  }
};
