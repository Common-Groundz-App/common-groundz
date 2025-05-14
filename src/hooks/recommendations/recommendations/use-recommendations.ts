
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { RecommendationCategory } from '@/services/recommendation/types';

export const useRecommendations = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [userRecommendations, setUserRecommendations] = useState<any[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecommendations = async (
    filters?: {
      category?: RecommendationCategory;
      userId?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { category, userId, limit = 10, offset = 0 } = filters || {};
      
      let query = supabase
        .from('recommendations')
        .select(`
          *,
          profiles:user_id (*),
          entity:entity_id (*)
        `)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setRecommendations(data || []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Error fetching recommendations:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserRecommendations = async (userId?: string) => {
    if (!userId && !user?.id) return [];
    
    setIsLoading(true);
    setError(null);
    
    try {
      const targetUserId = userId || user?.id;
      
      let query = supabase
        .from('recommendations')
        .select(`
          *,
          profiles:user_id (*),
          entity:entity_id (*)
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      setUserRecommendations(data || []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Error fetching user recommendations:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const likeRecommendation = async (recommendationId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like recommendations",
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('recommendation_likes')
        .insert({
          recommendation_id: recommendationId,
          user_id: user.id
        });
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error liking recommendation:', err);
      return false;
    }
  };

  const unlikeRecommendation = async (recommendationId: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('recommendation_likes')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error unliking recommendation:', err);
      return false;
    }
  };

  const saveRecommendation = async (recommendationId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save recommendations",
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('recommendation_saves')
        .insert({
          recommendation_id: recommendationId,
          user_id: user.id
        });
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error saving recommendation:', err);
      return false;
    }
  };

  const unsaveRecommendation = async (recommendationId: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('recommendation_saves')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error unsaving recommendation:', err);
      return false;
    }
  };

  return {
    recommendations,
    userRecommendations,
    isLoading,
    error,
    fetchRecommendations,
    fetchUserRecommendations,
    likeRecommendation,
    unlikeRecommendation,
    saveRecommendation,
    unsaveRecommendation,
  };
};
