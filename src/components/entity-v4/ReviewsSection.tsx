
import React, { useState } from 'react';
import { MessageCircle, Camera, Eye, Star, Users, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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

  // 4-tier priority system: Hybrid (circle+timeline), Circle-only, Timeline-only, Regular
  const timelineReviews = getTimelineReviews(filteredReviews);
  const allCircleReviews = hasCircleData ? 
    filteredReviews.filter(review => circleUserIds.includes(review.user_id)) : [];
  
  // 1. Hybrid reviews: both circle AND timeline (highest priority)
  const hybridReviews = timelineReviews.filter(review => 
    allCircleReviews.some(cr => cr.id === review.id)
  );
  
  // 2. Circle-only reviews: circle but NOT timeline
  const circleOnlyReviews = allCircleReviews.filter(review => 
    !timelineReviews.some(tr => tr.id === review.id)
  );
  
  // 3. Timeline-only reviews: timeline but NOT circle
  const timelineOnlyReviews = timelineReviews.filter(review => 
    !allCircleReviews.some(cr => cr.id === review.id)
  );
  
  const hybridReviewIds = new Set(hybridReviews.map(r => r.id));
  const circleOnlyReviewIds = new Set(circleOnlyReviews.map(r => r.id));
  const timelineOnlyReviewIds = new Set(timelineOnlyReviews.map(r => r.id));
  
  
  // 4. Regular reviews (lowest priority) - exclude all special categories
  const regularReviews = filteredReviews.filter(review => 
    !hybridReviewIds.has(review.id) && 
    !circleOnlyReviewIds.has(review.id) && 
    !timelineOnlyReviewIds.has(review.id)
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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Reviews & Social Proof</h2>
        </div>

        {/* Search and Filters Row - Yelp Style */}
        <div className="flex items-center gap-4 mb-6">
          {/* Search Bar - Left Side */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search reviews..." 
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Filter Dropdowns - Right Side */}
          <div className="flex gap-2">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-sm">
                  Sort 
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                <DropdownMenuItem 
                  onClick={() => toggleFilter('mostRecent')}
                  className={activeFilters.mostRecent ? "bg-blue-50 text-blue-700" : ""}
                >
                  {activeFilters.mostRecent && <span className="mr-2">✓</span>}
                  Most Recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setActiveFilters(prev => ({ ...prev, mostRecent: false }));
                }}>
                  Highest Rated
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Most Helpful
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-sm">
                  Filter
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                <DropdownMenuItem 
                  onClick={() => toggleFilter('verified')}
                  className={activeFilters.verified ? "bg-blue-50 text-blue-700" : ""}
                >
                  {activeFilters.verified && <span className="mr-2">✓</span>}
                  Verified Only
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => toggleFilter('fiveStars')}
                  className={activeFilters.fiveStars ? "bg-blue-50 text-blue-700" : ""}
                >
                  {activeFilters.fiveStars && <span className="mr-2">✓</span>}
                  5 Stars
                </DropdownMenuItem>
                {hasCircleData && (
                  <DropdownMenuItem 
                    onClick={() => toggleFilter('networkOnly')}
                    className={activeFilters.networkOnly ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.networkOnly && <span className="mr-2">✓</span>}
                    <Users className="w-3 h-3 mr-1" />
                    My Network ({circleUserIds.length})
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Review Cards - 4-Tier Priority System */}
        <div className="space-y-6">
          {/* 1. Hybrid Reviews (Circle + Timeline) - HIGHEST PRIORITY */}
          {hybridReviews.map(review => (
            <TimelineReviewCard
              key={review.id}
              review={review}
              onTimelineClick={handleTimelineClick}
              isCircleReview={true}
              circleUserName={review.user.username}
            />
          ))}

          {/* 2. Circle-Only Reviews - Second Priority */}
          {circleOnlyReviews.map(review => (
            <Card key={review.id} className="border-2 border-blue-200 bg-blue-50/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-blue-600 text-white">
                    <Users className="w-3 h-3 mr-1" />
                    From Your Circle
                  </Badge>
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-600 font-medium">
                    {review.user.username || 'Someone'} you follow reviewed this
                  </span>
                </div>
                <ReviewCard 
                  review={transformReviewForUI(review)} 
                  onHelpfulClick={onHelpfulClick}
                />
              </CardContent>
            </Card>
          ))}

          {/* 3. Timeline-Only Reviews - Third Priority */}
          {timelineOnlyReviews.map(review => (
            <TimelineReviewCard
              key={review.id}
              review={review}
              onTimelineClick={handleTimelineClick}
              isCircleReview={false}
              circleUserName={review.user.username}
            />
          ))}

          {/* Regular Reviews */}
          {transformedRegularReviews.length > 0 ? (
            transformedRegularReviews.map(review => (
              <ReviewCard 
                key={review.id} 
                review={review} 
                onHelpfulClick={onHelpfulClick}
              />
            ))
          ) : (
            !hybridReviews.length && !circleOnlyReviews.length && !timelineOnlyReviews.length && (
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
