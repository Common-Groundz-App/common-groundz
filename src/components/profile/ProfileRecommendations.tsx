
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRecommendations } from '@/hooks/use-recommendations';
import RecommendationFilters from '@/components/recommendations/RecommendationFilters';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import RecommendationSkeleton from '@/components/recommendations/RecommendationSkeleton';
import EmptyRecommendations from '@/components/recommendations/EmptyRecommendations';

type ProfileRecommendationsProps = {
  profileUserId: string;
  isOwnProfile?: boolean;
};

const ProfileRecommendations = ({ profileUserId, isOwnProfile = false }: ProfileRecommendationsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');
  
  console.log('ProfileRecommendations rendering with profileUserId:', profileUserId);
  
  const {
    recommendations,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshRecommendations
  } = useRecommendations({ 
    profileUserId
  });
  
  // Debug log recommendations when they change
  useEffect(() => {
    console.log('Recommendations in ProfileRecommendations:', recommendations?.length || 0);
    if (recommendations?.length) {
      console.log('First recommendation:', recommendations[0]);
    }
  }, [recommendations]);
  
  // Filter and sort recommendations
  const filteredRecommendations = React.useMemo(() => {
    if (!recommendations) return [];
    
    return recommendations
      .filter(item => !activeFilter || item.category === activeFilter)
      .sort((a, b) => {
        if (sortBy === 'latest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else if (sortBy === 'highestRated') {
          return b.rating - a.rating;
        } else if (sortBy === 'mostLiked') {
          return (b.likes || 0) - (a.likes || 0);
        }
        return 0;
      });
  }, [recommendations, activeFilter, sortBy]);
  
  const categories = recommendations.length > 0 
    ? [...new Set(recommendations.map(item => item.category))] 
    : [];

  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('latest');
  };

  const handleRecommendationDeleted = () => {
    refreshRecommendations();
  };

  if (isLoading) {
    return <RecommendationSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-8 rounded-xl bg-destructive/5 p-6">
        <p className="text-destructive">Error loading recommendations. Please try again.</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <EmptyRecommendations 
        isOwnProfile={isOwnProfile}
        hasActiveFilter={!!activeFilter}
        onClearFilters={clearFilters}
        // Remove onAddNew since users can no longer create recommendations directly
        onAddNew={undefined}
      />
    );
  }

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
        // Remove onAddNew since users can no longer create recommendations directly
        onAddNew={undefined}
      />
      
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
    </div>
  );
}

export default ProfileRecommendations;
