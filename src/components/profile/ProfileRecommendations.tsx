
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRecommendations } from '@/hooks/use-recommendations';
import RecommendationForm from '@/components/recommendations/RecommendationForm';
import RecommendationFilters from '@/components/recommendations/RecommendationFilters';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import RecommendationSkeleton from '@/components/recommendations/RecommendationSkeleton';
import EmptyRecommendations from '@/components/recommendations/EmptyRecommendations';

type ProfileRecommendationsProps = {
  profileUserId?: string;
};

const ProfileRecommendations = ({ profileUserId }: ProfileRecommendationsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const {
    recommendations,
    isLoading,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    handleLike,
    handleSave,
    handleImageUpload,
    addRecommendation,
    clearFilters
  } = useRecommendations({ 
    profileUserId: profileUserId || (user?.id || '') 
  });
  
  const categories = [...new Set(recommendations.map(item => item.category))];
  const isOwnProfile = user?.id === profileUserId || (!profileUserId && !!user);
  
  const handleFormSubmit = async (values: any) => {
    const result = await addRecommendation({
      title: values.title,
      venue: values.venue || null,
      description: values.description || null,
      rating: values.rating,
      image_url: values.image_url,
      category: values.category,
      visibility: values.visibility,
      is_certified: false,
      view_count: 0
    });
    
    if (result) {
      toast({
        title: "Recommendation added",
        description: "Your recommendation has been added successfully"
      });
      setIsFormOpen(false);
    }
  };

  return (
    <div className="space-y-6 mx-0 my-0">
      <RecommendationFilters 
        isOwnProfile={isOwnProfile}
        activeFilter={activeFilter}
        sortBy={sortBy}
        categories={categories}
        onFilterChange={setActiveFilter}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        onAddNew={() => setIsFormOpen(true)}
      />
      
      {isLoading ? (
        <RecommendationSkeleton />
      ) : recommendations.length === 0 ? (
        <EmptyRecommendations 
          isOwnProfile={isOwnProfile}
          hasActiveFilter={!!activeFilter}
          onClearFilters={clearFilters}
          onAddNew={() => setIsFormOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map(item => (
            <RecommendationCard 
              key={item.id}
              recommendation={item}
              onLike={handleLike}
              onSave={handleSave}
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
};

export default ProfileRecommendations;
