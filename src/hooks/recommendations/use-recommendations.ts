
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Import sub-hooks
import { useRecommendationFilters } from './use-recommendation-filters';
import { useRecommendationFetch } from './use-recommendations-fetch';
import { useRecommendationActions } from './use-recommendation-actions';
import { useRecommendationUploads } from './use-recommendation-uploads';
import { useEntityOperations } from './use-entity-operations';

interface UseRecommendationsProps {
  profileUserId?: string;
  entityId?: string;
  category?: string;
  limit?: number;
}

export const useRecommendations = ({
  profileUserId,
  entityId,
  category,
  limit = 50
}: UseRecommendationsProps = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize sub-hooks
  const { activeFilter, setActiveFilter, sortBy, setSortBy, clearFilters } = useRecommendationFilters();
  
  const { recommendations, fetchRecommendations, refreshRecommendations } = 
    useRecommendationFetch({
      profileUserId,
      entityId,
      category: activeFilter || category,
      sortBy,
      limit
    });
  
  const { handleLike, handleSave } = useRecommendationActions();
  const { handleImageUpload } = useRecommendationUploads();
  const { searchEntities } = useEntityOperations();

  // Add a new recommendation
  const addRecommendation = async (recommendationData: any) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create a recommendation",
        variant: "destructive"
      });
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .insert({
          ...recommendationData,
          user_id: user.id,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select();

      if (error) throw error;
      
      await refreshRecommendations();
      return data[0];
    } catch (error: any) {
      console.error("Error adding recommendation:", error);
      toast({
        title: "Failed to add recommendation",
        description: error.message || "Please try again",
        variant: "destructive"
      });
      return null;
    }
  };

  // Initial fetch
  useEffect(() => {
    const loadRecommendations = async () => {
      setIsLoading(true);
      try {
        await fetchRecommendations();
      } catch (err: any) {
        console.error("Error loading recommendations:", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [fetchRecommendations, activeFilter, sortBy]);

  // Return consolidated hook data and functions
  return {
    recommendations,
    isLoading,
    error,
    activeFilter,
    setActiveFilter,
    sortBy, 
    setSortBy,
    handleLike,
    handleSave,
    handleImageUpload,
    searchEntities,
    addRecommendation,
    clearFilters,
    refreshRecommendations
  };
};

export default useRecommendations;
