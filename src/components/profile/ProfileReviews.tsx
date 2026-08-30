
import React, { useState, useCallback, useEffect } from 'react';
import EmptyReviews from './reviews/EmptyReviews';
import { useReviews } from '@/hooks/use-reviews';
import ReviewCard from './reviews/ReviewCard';
import ReviewForm from './reviews/ReviewForm';
import ReviewFilters from './reviews/ReviewFilters';
import { useAuth } from '@/contexts/AuthContext';
import { resolveReviewDisplayType, displayTypeValue } from './reviews/reviewDisplayType';

interface ProfileReviewsProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileReviews = ({ profileUserId, isOwnProfile }: ProfileReviewsProps) => {
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');
  
  const {
    reviews,
    isLoading,
    error,
    handleLike,
    refreshReviews,
    convertToRecommendation,
  } = useReviews({ profileUserId });

  // Create a wrapped version of refreshReviews that returns void
  const handleRefreshReviews = useCallback(async () => {
    await refreshReviews();
  }, [refreshReviews]);

  // Phase 2.5A — one resolved display type per row, shared by the filter chips
  // and the card badges. Verified canonical/legacy types only; rows with a
  // failed or unattempted subject lookup keep their stored category. Never
  // invents a type for rows that have none.
  const resolvedReviews = React.useMemo(() => {
    if (!reviews) return [];
    return reviews.map((review) => ({
      review,
      resolvedType: displayTypeValue(
        resolveReviewDisplayType({
          entityId: review.entity_id,
          category: review.category,
          subjectRelation: review.subjectRelation,
        })
      ),
    }));
  }, [reviews]);

  // Filter and sort reviews
  const filteredReviews = React.useMemo(() => {
    return resolvedReviews
      .filter(({ resolvedType }) => !activeFilter || resolvedType === activeFilter)
      .map(({ review }) => review)
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
  }, [resolvedReviews, activeFilter, sortBy]);

  // Extract unique resolved types for the filter chips
  const categories = React.useMemo(() => {
    return [...new Set(resolvedReviews.map(({ resolvedType }) => resolvedType).filter((t) => !!t))] as string[];
  }, [resolvedReviews]);

  // Reset a stale selection after the resolved set changes (e.g. the review
  // powering a chip was deleted or its subject was unlinked).
  useEffect(() => {
    if (activeFilter && !categories.includes(activeFilter)) {
      setActiveFilter(null);
    }
  }, [categories, activeFilter]);

  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('latest');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
          <div className="h-10 w-28 bg-gray-100 dark:bg-gray-800 animate-pulse rounded"></div>
        </div>
        
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className="w-full h-60 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-800/30 animate-pulse rounded-xl shadow-sm"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 rounded-xl bg-destructive/5 p-6">
        <p className="text-destructive">Error loading reviews. Please try again.</p>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <EmptyReviews 
          isOwnProfile={isOwnProfile} 
          onCreateReview={() => setIsFormOpen(true)} 
        />
        {isFormOpen && isOwnProfile && (
          <ReviewForm 
            isOpen={isFormOpen} 
            onClose={() => setIsFormOpen(false)} 
            onSubmit={handleRefreshReviews}
          />
        )}
      </div>
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
        onAddNew={() => setIsFormOpen(true)}
      />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReviews.map(review => (
          <ReviewCard 
            key={review.id}
            review={review}
            onLike={handleLike}
            
            onConvert={isOwnProfile ? convertToRecommendation : undefined}
            refreshReviews={handleRefreshReviews}
            showTimelineFeatures={isOwnProfile && user?.id === review.user_id}
          />
        ))}
      </div>
      
      {isFormOpen && isOwnProfile && (
        <ReviewForm 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)} 
          onSubmit={handleRefreshReviews}
        />
      )}
    </div>
  );
};

export default ProfileReviews;
