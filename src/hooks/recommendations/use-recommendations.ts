
import { useRecommendationsFetch } from './use-recommendations-fetch';
import { useRecommendationFilters } from './use-recommendation-filters';
import { useRecommendationActions } from './use-recommendation-actions';
import { useRecommendationUploads } from './use-recommendation-uploads';

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
  
  const {
    handleLike,
    handleSave,
    addRecommendation
  } = useRecommendationActions(recommendations, setRecommendations, refreshRecommendations);
  
  const { handleImageUpload } = useRecommendationUploads();

  return {
    // Data state
    recommendations: filteredRecommendations,
    isLoading,
    error,
    categories,
    
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
    refreshRecommendations
  };
};
