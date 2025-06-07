
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useReviews } from '@/hooks/use-reviews';
import ReviewCard from '@/components/profile/reviews/ReviewCard';
import EmptyReviews from '@/components/profile/reviews/EmptyReviews';
import ReviewFilters from '@/components/profile/reviews/ReviewFilters';

type ProfileDynamicReviewsProps = {
  profileUserId: string;
  isOwnProfile?: boolean;
};

const ProfileDynamicReviews = ({ profileUserId, isOwnProfile = false }: ProfileDynamicReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');
  
  console.log('ProfileDynamicReviews rendering with profileUserId:', profileUserId);
  
  const {
    reviews,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshReviews
  } = useReviews({ profileUserId });
  
  // Filter reviews to only show those that are marked as recommendations (4+ stars) or have timeline
  const dynamicReviews = React.useMemo(() => {
    if (!reviews) return [];
    
    return reviews
      .filter(review => review.is_recommended || review.has_timeline)
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
  }, [reviews, activeFilter, sortBy]);
  
  const categories = dynamicReviews.length > 0 
    ? [...new Set(dynamicReviews.map(item => item.category))] 
    : [];

  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('latest');
  };

  const handleReviewDeleted = () => {
    refreshReviews();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 rounded-xl bg-destructive/5 p-6">
        <p className="text-destructive">Error loading dynamic reviews. Please try again.</p>
      </div>
    );
  }

  if (dynamicReviews.length === 0) {
    return (
      <EmptyReviews 
        isOwnProfile={isOwnProfile}
        hasActiveFilter={!!activeFilter}
        onClearFilters={clearFilters}
        type="dynamic"
        message={isOwnProfile 
          ? "You haven't created any dynamic reviews yet. Share highly-rated experiences or add timeline updates to existing reviews!"
          : "This user hasn't created any dynamic reviews yet."
        }
      />
    );
  }

  return (
    <div className="space-y-6 mx-0 my-0">
      <ReviewFilters 
        isOwnProfile={isOwnProfile}
        activeFilter={activeFilter}
        sortBy={sortBy}
        categories={categories}
        onFilterChange={setActiveFilter}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        title={isOwnProfile ? 'My Dynamic Reviews' : 'Dynamic Reviews'}
        subtitle="High-rated reviews and experiences with timeline updates"
      />
      
      <div className="grid grid-cols-1 gap-6">
        {dynamicReviews.map(review => (
          <ReviewCard 
            key={review.id}
            review={review}
            onLike={handleLike}
            onSave={handleSave}
            onDeleted={handleReviewDeleted}
            refreshReviews={refreshReviews}
            showTimelineIndicator={true}
            compact={false}
          />
        ))}
      </div>
    </div>
  );
}

export default ProfileDynamicReviews;
