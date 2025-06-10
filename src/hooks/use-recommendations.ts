
import { useState, useEffect } from 'react';
import { fetchUserRecommendations, Recommendation } from '@/services/recommendationService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useRecommendations = (profileUserId: string) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchUserRecommendationsData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Pass the required arguments to fetchUserRecommendations
      const result = await fetchUserRecommendations(
        user?.id || null,
        profileUserId,
        undefined, // category
        'latest', // sortBy
        1, // page
        10 // limit
      );
      // Extract just the recommendations array from the result
      setRecommendations(result.recommendations);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRecommendationsData();
  }, [profileUserId, user]);

  const handleLike = async (id: string) => {
    // Stub implementation for compatibility
    console.log('Like recommendation:', id);
  };

  const handleSave = async (id: string) => {
    // Stub implementation for compatibility
    console.log('Save recommendation:', id);
  };

  return {
    recommendations,
    isLoading,
    error,
    refetch: fetchUserRecommendationsData,
    handleLike,
    handleSave,
    refreshRecommendations: fetchUserRecommendationsData,
  };
};
