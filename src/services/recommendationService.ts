
import { supabase } from '@/integrations/supabase/client';
import { Recommendation } from './recommendation/types';
import { fetchRecommendationById as fetchRecommendationByIdFromTypes } from './recommendation/fetchRecommendationById';

export const fetchRecommendationById = async (id: string, userId: string | null = null): Promise<Recommendation | null> => {
  return fetchRecommendationByIdFromTypes(id, userId);
};
