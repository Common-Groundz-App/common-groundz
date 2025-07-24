
import React, { useState } from 'react';
import { MessageCircle, Camera, Eye, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReviewCard from "@/components/ReviewCard";
import { ReviewWithUser } from '@/types/entities';
import { 
  transformReviewForUI, 
  filterReviews, 
  getTimelineReviews
} from '@/utils/reviewDataUtils';
import { TimelineReviewCard } from './TimelineReviewCard';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { NetworkRecommendations } from './NetworkRecommendations';
import { useAuth } from '@/contexts/AuthContext';
import { useCircleReviews } from '@/hooks/useCircleReviews';

interface ReviewsSectionProps {
  reviews: ReviewWithUser[];
  entityName: string;
  entityId: string;
  onHelpfulClick?: (reviewId: string) => void;
  onQuestionClick?: () => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ 
  reviews = [], 
  entityName = '',
  entityId = '',
  onHelpfulClick,
  onQuestionClick 
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const { circleReviews, circleUserIds, isLoading: circleLoading } = useCircleReviews(entityId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    mostRecent: false,
    verified: false,
    fiveStars: false,
    networkOnly: false
  });
  const [selectedTimelineReview, setSelectedTimelineReview] = useState<ReviewWithUser | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Enhanced debugging with circle reviews data
  console.log('🔍 ReviewsSection - Circle Reviews Debug:');
  console.log('  📊 Environment Info:', {
    currentUrl: typeof window !== 'undefined' ? window.location.href : 'SSR',
    hasAuth: !!user,
    authLoading,
    userId: user?.id
  });
  console.log('  🔵 Circle Data:', {
    circleUserIds,
    circleUserIdsLength: circleUserIds.length,
    circleReviews: circleReviews.length,
    circleLoading,
    circleReviewDetails: circleReviews.map(r => ({ 
      id: r.id, 
      username: r.user.username,
      user_id: r.user_id,
      rating: r.rating,
      title: r.title
    }))
  });
  console.log('  📝 All Reviews Data:', {
    totalReviews: reviews.length,
    reviewDetails: reviews.map(r => ({ 
      id: r.id, 
      username: r.user.username,
      user_id: r.user_id,
      rating: r.rating,
      isInCircle: circleUserIds.includes(r.user_id)
    }))
  });

  const isAuthenticated = !!user && !authLoading;
  const hasCircleData = isAuthenticated && !circleLoading && circleUserIds.length > 0;

  // Process reviews with filters - using circleUserIds from the hook
  const filteredReviews = filterReviews(reviews, {
    search: searchQuery || undefined,
    verified: activeFilters.verified || undefined,
    rating: activeFilters.fiveStars ? 5 : undefined,
    mostRecent: activeFilters.mostRecent || undefined,
    networkOnly: activeFilters.networkOnly || undefined
  }, circleUserIds);

  console.log('🔍 After filtering:', {
    filteredCount: filteredReviews.length,
    activeFilters,
    hasCircleData,
    isAuthenticated
  });

  // Get special review categories with priority system to prevent duplicates
  // 1. Timeline reviews (highest priority)
  const timelineReviews = getTimelineReviews(filteredReviews);
  const timelineReviewIds = new Set(timelineReviews.map(r => r.id));
  
  // 2. Circle highlighted reviews (second priority) - exclude timeline reviews
  const circleHighlightedReviews = hasCircleData ? 
    filteredReviews.filter(review => 
      circleUserIds.includes(review.user_id) && 
      !timelineReviewIds.has(review.id)
    ) : [];
  const circleHighlightedReviewIds = new Set(circleHighlightedReviews.map(r => r.id));
  
  console.log('🔍 Special Categories (Deduplicated):', {
    timelineReviews: timelineReviews.length,
    circleHighlighted: circleHighlightedReviews.length,
    hasCircleData,
    timelineDetails: timelineReviews.map(r => ({
      id: r.id,
      user: r.user.username,
      user_id: r.user_id,
      rating: r.rating,
      title: r.title,
      isUserInCircle: circleUserIds.includes(r.user_id),
      showNetworkBadge: circleUserIds.includes(r.user_id)
    })),
    circleHighlightedDetails: circleHighlightedReviews.map(r => ({
      id: r.id,
      user: r.user.username,
      user_id: r.user_id,
      rating: r.rating,
      title: r.title
    }))
  });
  
  // 3. Regular reviews (lowest priority) - exclude both timeline and circle highlighted
  const regularReviews = filteredReviews.filter(review => 
    !timelineReviewIds.has(review.id) && 
    !circleHighlightedReviewIds.has(review.id)
  );

  // Transform reviews for UI
  const transformedRegularReviews = regularReviews.slice(0, 3).map(transformReviewForUI);

  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  const handleTimelineClick = (review: ReviewWithUser) => {
    setSelectedTimelineReview(review);
    setIsTimelineViewerOpen(true);
  };

  const handleTimelineViewerClose = () => {
    setIsTimelineViewerOpen(false);
    setSelectedTimelineReview(null);
  };

  return (
    <>
      {/* Ask Community */}
      <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Ask the Community</h3>
              <p className="text-sm text-gray-600">Get answers from people who have used {entityName} products</p>
            </div>
            <Button 
              variant="outline" 
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={onQuestionClick}
            >
              Ask Question
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Reviews & Social Proof */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Reviews & Social Proof</h2>
          <div className="flex gap-2">
            <Badge 
              variant={activeFilters.mostRecent ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleFilter('mostRecent')}
            >
              Most Recent
            </Badge>
            <Badge 
              variant={activeFilters.verified ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleFilter('verified')}
            >
              Verified Only
            </Badge>
            <Badge 
              variant={activeFilters.fiveStars ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleFilter('fiveStars')}
            >
              5 Stars
            </Badge>
            {/* Only show network filter if user is authenticated and has circle data */}
            {hasCircleData && (
              <Badge 
                variant={activeFilters.networkOnly ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleFilter('networkOnly')}
              >
                <Users className="w-3 h-3 mr-1" />
                My Network ({circleUserIds.length})
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="text-xs"
            >
              Debug
            </Button>
          </div>
        </div>

        {/* Debug Info */}
        {showDebugInfo && (
          <div className="mb-4 p-4 bg-gray-100 rounded text-xs space-y-2">
            <div className="font-semibold">🔍 Circle Reviews Debug:</div>
            <div>Auth Status: {isAuthenticated ? 'Authenticated' : authLoading ? 'Loading...' : 'Not authenticated'}</div>
            <div>User ID: {user?.id || 'None'}</div>
            <div>Circle Loading: {circleLoading ? 'Yes' : 'No'}</div>
            <div>Following {circleUserIds.length} users: [{circleUserIds.join(', ')}]</div>
            <div>Circle reviews found: {circleReviews.length}</div>
            <div>Circle highlighted reviews: {circleHighlightedReviews.length}</div>
            <div>Timeline reviews: {timelineReviews.length}</div>
            <div>Regular reviews: {regularReviews.length}</div>
            <div>Reviews by followed users: {reviews.filter(r => circleUserIds.includes(r.user_id)).map(r => r.user.username).join(', ')}</div>
            <div className="font-semibold">Expected: Reviews from people you follow should appear with "Trending in Your Network" badge</div>
            {!isAuthenticated && (
              <div className="text-red-600 font-semibold">⚠️ Not authenticated - circle highlighting disabled</div>
            )}
            {isAuthenticated && circleUserIds.length === 0 && !circleLoading && (
              <div className="text-orange-600 font-semibold">⚠️ No following data - you don't follow anyone yet</div>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <input 
            type="text" 
            placeholder="Search reviews..." 
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Review Cards */}
        <div className="space-y-6">
          {/* Circle Reviews - Highest Priority */}
          {circleHighlightedReviews.length > 0 && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Reviews From People You Follow ({circleHighlightedReviews.length})
                </h3>
              </div>
              <div className="space-y-4 bg-blue-50/30 rounded-lg p-4 border border-blue-200">
                {circleHighlightedReviews.map(review => (
                  <ReviewCard 
                    key={review.id}
                    review={transformReviewForUI(review)} 
                    onHelpfulClick={onHelpfulClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timeline Reviews - Second Priority */}
          {timelineReviews.length > 0 && timelineReviews.map(review => {
            const isInNetwork = hasCircleData && circleUserIds.includes(review.user_id);
            return (
              <div key={review.id} className="relative">
                {isInNetwork && (
                  <div className="mb-2">
                    <Badge className="bg-blue-600 text-white">
                      <Users className="w-3 h-3 mr-1" />
                      Trending in Your Network
                    </Badge>
                  </div>
                )}
                <TimelineReviewCard
                  review={review}
                  onTimelineClick={handleTimelineClick}
                />
              </div>
            );
          })}

          {/* Regular Reviews - Lowest Priority */}
          {transformedRegularReviews.length > 0 ? (
            transformedRegularReviews.map(review => (
              <ReviewCard 
                key={review.id} 
                review={review} 
                onHelpfulClick={onHelpfulClick}
              />
            ))
          ) : (
            !timelineReviews.length && !circleHighlightedReviews.length && (
              <div className="text-center py-8 text-gray-500">
                {reviews.length === 0 ? (
                  <p>No reviews yet. Be the first to share your experience!</p>
                ) : (
                  <p>No reviews match your current filters.</p>
                )}
              </div>
            )
          )}
        </div>

        {/* Photo Gallery */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Photos & Videos
              </CardTitle>
              <Button variant="outline" size="sm">
                <Camera className="w-4 h-4 mr-2" />
                Add Photos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                  <Camera className="w-6 h-6 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network-Based Recommendations - Only show if authenticated */}
        {isAuthenticated && (
          <div className="mt-8">
            <NetworkRecommendations 
              entityId={entityId}
              userFollowingIds={circleUserIds}
            />
          </div>
        )}

        {/* Meet the Founders */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop" alt="Founder" className="w-16 h-16 rounded-full object-cover" />
              <div>
                <h3 className="font-semibold text-gray-900">Meet the Founder</h3>
                <p className="text-blue-600 font-medium">Rohit Sharma</p>
                <p className="text-sm text-gray-600">CEO & Co-founder</p>
                <p className="text-sm text-gray-500 mt-1">15+ years in health & wellness industry</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Viewer Modal */}
      {selectedTimelineReview && (
        <ReviewTimelineViewer
          isOpen={isTimelineViewerOpen}
          onClose={handleTimelineViewerClose}
          reviewId={selectedTimelineReview.id}
          reviewOwnerId={selectedTimelineReview.user_id}
          reviewTitle={selectedTimelineReview.title}
          initialRating={selectedTimelineReview.rating}
          onTimelineUpdate={() => {
            // Could refresh reviews here if needed
          }}
        />
      )}
    </>
  );
};
