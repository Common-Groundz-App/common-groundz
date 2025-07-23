
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
  getTimelineReviews, 
  getCircleHighlightedReviews,
  getNetworkContext
} from '@/utils/reviewDataUtils';
import { TimelineReviewCard } from './TimelineReviewCard';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { NetworkRecommendations } from './NetworkRecommendations';

interface ReviewsSectionProps {
  reviews: ReviewWithUser[];
  entityName: string;
  entityId: string;
  userFollowingIds?: string[];
  onHelpfulClick?: (reviewId: string) => void;
  onQuestionClick?: () => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ 
  reviews = [], 
  entityName = '',
  entityId = '',
  userFollowingIds = [],
  onHelpfulClick,
  onQuestionClick 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    mostRecent: false,
    verified: false,
    fiveStars: false
  });
  const [selectedTimelineReview, setSelectedTimelineReview] = useState<ReviewWithUser | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);

  // Process reviews with filters
  const filteredReviews = filterReviews(reviews, {
    search: searchQuery || undefined,
    verified: activeFilters.verified || undefined,
    rating: activeFilters.fiveStars ? 5 : undefined,
    mostRecent: activeFilters.mostRecent || undefined
  });

  // Get special review categories
  const timelineReviews = getTimelineReviews(filteredReviews);
  const circleHighlightedReviews = getCircleHighlightedReviews(filteredReviews, userFollowingIds);
  
  // Get regular reviews (excluding timeline and circle highlighted)
  const regularReviews = filteredReviews.filter(review => 
    !timelineReviews.includes(review) && 
    !circleHighlightedReviews.includes(review)
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
          </div>
        </div>

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
          {/* Timeline Reviews - Display first with new component */}
          {timelineReviews.map(review => (
            <TimelineReviewCard
              key={review.id}
              review={review}
              onTimelineClick={handleTimelineClick}
            />
          ))}

          {/* Circle Highlighted Review */}
          {circleHighlightedReviews.length > 0 && (
            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-blue-600 text-white">
                    <Users className="w-3 h-3 mr-1" />
                    Trending in Your Network
                  </Badge>
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-600 font-medium">
                    {circleHighlightedReviews[0].user.username || 'Someone'} you follow loved this
                  </span>
                </div>
                <ReviewCard 
                  review={transformReviewForUI(circleHighlightedReviews[0])} 
                  onHelpfulClick={onHelpfulClick}
                />
              </CardContent>
            </Card>
          )}

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

        {/* Network-Based Recommendations */}
        <div className="mt-8">
          <NetworkRecommendations 
            entityId={entityId}
            userFollowingIds={userFollowingIds}
          />
        </div>

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
