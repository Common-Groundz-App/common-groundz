
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useReviews } from '@/hooks/use-reviews';
import { useRecommendationFilters } from '@/hooks/recommendations/use-recommendation-filters';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import RecommendationForm from '@/components/recommendations/RecommendationForm';
import RecommendationFilters from '@/components/recommendations/RecommendationFilters';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import RecommendationSkeleton from '@/components/recommendations/RecommendationSkeleton';
import EmptyRecommendations from '@/components/recommendations/EmptyRecommendations';
import { Review } from '@/services/reviewService';
import { Recommendation } from '@/services/recommendation/types';

type ProfileRecommendationsProps = {
  profileUserId: string;
  isOwnProfile?: boolean;
};

const ProfileRecommendations = ({ profileUserId, isOwnProfile = false }: ProfileRecommendationsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Fetch recommendations (actually reviews that we treat as recommendations)
  const {
    reviews,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshReviews
  } = useReviews({ 
    profileUserId
  });
  
  // Handle image uploads for recommendation form
  const { handleImageUpload } = useRecommendationUploads();
  
  // Convert reviews to recommendations format for filtering
  const reviewsAsRecommendations = reviews ? reviews.map(review => ({
    ...review,
    is_certified: false,
    view_count: 0,
  } as Recommendation)) : [];
  
  // Apply filtering and sorting
  const {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredRecommendations,
    categories,
    clearFilters
  } = useRecommendationFilters(reviewsAsRecommendations);
  
  useEffect(() => {
    const handleOpenForm = () => {
      setIsFormOpen(true);
    };
    
    window.addEventListener('open-recommendation-form', handleOpenForm);
    return () => {
      window.removeEventListener('open-recommendation-form', handleOpenForm);
    };
  }, []);
  
  const handleFormSubmit = async (values: any) => {
    try {
      // Implementation of recommendation submission
      // This is placeholder code - the actual implementation would need to be added
      toast({
        title: "Recommendation added",
        description: "Your recommendation has been added successfully"
      });
      setIsFormOpen(false);
      refreshReviews();
    } catch (error) {
      console.error('Error adding recommendation:', error);
      toast({
        title: "Error",
        description: "Failed to add recommendation. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRecommendationDeleted = () => {
    refreshReviews();
  };

  return (
    <div className="space-y-6 mx-0 my-0">
      <RecommendationFilters 
        isOwnProfile={isOwnProfile}
        activeFilter={activeFilter}
        sortBy={sortBy}
        categories={categories as string[]}
        onFilterChange={setActiveFilter}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        onAddNew={() => setIsFormOpen(true)}
      />
      
      {isLoading ? (
        <RecommendationSkeleton />
      ) : filteredRecommendations.length === 0 ? (
        <EmptyRecommendations 
          isOwnProfile={isOwnProfile}
          hasActiveFilter={!!activeFilter}
          onClearFilters={clearFilters}
          onAddNew={() => setIsFormOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecommendations.map(item => (
            <RecommendationCard 
              key={item.id}
              recommendation={item}
              onLike={handleLike}
              onSave={handleSave}
              onDeleted={handleRecommendationDeleted}
            />
          ))}
        </div>
      )}
      
      {user && (
        <RecommendationForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          onImageUpload={handleImageUpload}
        />
      )}
    </div>
  );
}

export default ProfileRecommendations;
