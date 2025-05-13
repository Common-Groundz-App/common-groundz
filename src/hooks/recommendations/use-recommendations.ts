
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Import sub-hooks
import { useRecommendationFilters } from './use-recommendation-filters';
import { useRecommendationsFetch } from './use-recommendations-fetch';
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

  // Initialize the fetch hook first since we need recommendations for filters
  const { recommendations, setRecommendations, isLoading: isFetching, refreshRecommendations } = 
    useRecommendationsFetch({
      profileUserId,
      category: category,
      limit
    });
  
  // Now we can pass recommendations to the filters hook
  const { activeFilter, setActiveFilter, sortBy, setSortBy, clearFilters } = 
    useRecommendationFilters(recommendations);
  
  // Pass required arguments to recommendation actions hook
  const { handleLike, handleSave, addRecommendation } = 
    useRecommendationActions(recommendations, setRecommendations, refreshRecommendations);
    
  const { handleImageUpload } = useRecommendationUploads();
  const { searchEntities } = useEntityOperations();

  // Update category when activeFilter changes
  useEffect(() => {
    // This effect will run when activeFilter changes
    // The recommendations will be updated by the useRecommendationsFetch hook
  }, [activeFilter, category]);

  // Initial fetch
  useEffect(() => {
    const loadRecommendations = async () => {
      setIsLoading(false); // We're using the isLoading from useRecommendationsFetch instead
    };

    loadRecommendations();
  }, [activeFilter, sortBy]);

  // Return consolidated hook data and functions
  return {
    recommendations,
    isLoading: isFetching, // Use the loading state from the fetch hook
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
