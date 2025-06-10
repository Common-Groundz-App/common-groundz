import { useState, useEffect } from 'react';
import { fetchRecommendations } from '@/services/recommendationService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Recommendation {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  image_url?: string;
  link?: string;
  category: string;
  user_id: string;
  metadata?: any;
  likes?: number;
  saves?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export const useRecommendations = (profileUserId: string) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchUserRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchRecommendations(); // Remove the arguments
      setRecommendations(data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRecommendations();
  }, [profileUserId, user]);

  return {
    recommendations,
    isLoading,
    error,
    refetch: fetchUserRecommendations,
  };
};
