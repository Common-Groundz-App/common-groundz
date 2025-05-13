
import { useRecommendationsFetch } from './use-recommendations-fetch';
import { useRecommendationFilters } from './use-recommendation-filters';
import { useRecommendationActions } from './use-recommendation-actions';
import { useRecommendationUploads } from './use-recommendation-uploads';
import { useEntityOperations } from './use-entity-operations';
import { useCallback } from 'react';

interface UseRecommendationsProps {
  profileUserId: string;
}

export const useRecommendations = ({ profileUserId }: UseRecommendationsProps) => {
  const { 
    recommendations, 
    setRecommendations, 
    isLoading, 
    error, 
    refreshRecommendations 
  } = useRecommendationsFetch({ profileUserId });
  
  const {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredRecommendations,
    categories,
    clearFilters
  } = useRecommendationFilters(recommendations);
  
  // Wrap refreshRecommendations in useCallback to prevent unnecessary rerenders
  const refreshRecommendationsCallback = useCallback(async () => {
    await refreshRecommendations();
  }, [refreshRecommendations]);
  
  const {
    handleLike,
    handleSave,
    addRecommendation
  } = useRecommendationActions(recommendations, setRecommendations, refreshRecommendationsCallback);
  
  const { handleImageUpload } = useRecommendationUploads();

  const {
    entities,
    isLoading: isLoadingEntities,
    handleEntityCreation,
    searchEntities
  } = useEntityOperations();

  return {
    // Data state
    recommendations: filteredRecommendations,
    isLoading: isLoading || isLoadingEntities,
    error,
    categories,
    entities,
    
    // Filter state
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    clearFilters,
    
    // Actions
    handleLike,
    handleSave,
    handleImageUpload,
    addRecommendation,
    refreshRecommendations: refreshRecommendationsCallback,
    
    // Entity operations
    handleEntityCreation,
    searchEntities
  };
};
