
import React, { useState } from 'react';
import { MessageCircle, Camera, Eye, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReviewCard from "@/components/ReviewCard";
import { ReviewWithUser } from '@/types/entities';
import { TimelineBadge } from '@/components/profile/reviews/TimelineBadge';
import { TimelinePreview } from '@/components/profile/reviews/TimelinePreview';
import { useTimelineReviews } from '@/hooks/use-timeline-reviews';
import { 
  transformReviewForUI, 
  filterReviews, 
  getTimelineReviews, 
  getCircleHighlightedReviews,
  transformTimelineUpdates,
  calculateTimelineProgression
} from '@/utils/reviewDataUtils';

interface ReviewsSectionProps {
  reviews: ReviewWithUser[];
  entityName: string;
  userFollowingIds?: string[];
  onHelpfulClick?: (reviewId: string) => void;
  onQuestionClick?: () => void;
  onTimelineClick?: (reviewId: string, reviewOwnerId: string, reviewTitle: string, initialRating: number) => void;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ 
  reviews = [], 
  entityName = '',
  userFollowingIds = [],
  onHelpfulClick,
  onQuestionClick,
  onTimelineClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    mostRecent: false,
    verified: false,
    fiveStars: false
  });

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

  // Fetch real timeline data for timeline reviews
  const timelineData = useTimelineReviews(timelineReviews);

  // Transform reviews for UI
  const transformedReviews = filteredReviews.slice(0, 3).map(transformReviewForUI);

  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  const handleTimelineClick = (review: ReviewWithUser) => {
    if (onTimelineClick) {
      onTimelineClick(review.id, review.user_id, review.title, review.rating);
    }
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
          {transformedReviews.length > 0 ? (
            transformedReviews.map(review => (
              <ReviewCard 
                key={review.id} 
                review={review} 
                onHelpfulClick={onHelpfulClick}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              {reviews.length === 0 ? (
                <p>No reviews yet. Be the first to share your experience!</p>
              ) : (
                <p>No reviews match your current filters.</p>
              )}
            </div>
          )}

          {/* Enhanced Timeline Review with Real Data */}
          {timelineReviews.length > 0 && (() => {
            const firstTimelineReview = timelineReviews[0];
            const timelineInfo = timelineData.get(firstTimelineReview.id);
            
            if (!timelineInfo) {
              return (
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="animate-pulse h-4 w-24 bg-gray-200 rounded"></div>
                    </div>
                    <p className="text-gray-500">Loading timeline data...</p>
                  </CardContent>
                </Card>
              );
            }

            const { review, updates, isLoading } = timelineInfo;
            const timelineSteps = transformTimelineUpdates(review, updates);
            const progression = calculateTimelineProgression(review, updates);

            return (
              <Card 
                className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTimelineClick(review)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <img 
                      src={review.user.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop"} 
                      alt="Timeline reviewer" 
                      className="w-12 h-12 rounded-full" 
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-semibold">{review.user.username}</h4>
                        <TimelineBadge 
                          updateCount={updates.length} 
                          variant="default"
                        />
                        <Badge className="bg-blue-100 text-blue-800">Timeline Review</Badge>
                      </div>

                      {/* Timeline Preview */}
                      {progression.hasProgression && (
                        <div className="mb-4">
                          <TimelinePreview
                            initialRating={progression.initialRating}
                            latestRating={progression.latestRating}
                            updateCount={progression.updateCount}
                          />
                        </div>
                      )}

                      {/* Timeline Steps */}
                      {isLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse">
                              <div className="h-3 w-20 bg-gray-200 rounded mb-1"></div>
                              <div className="h-4 w-full bg-gray-200 rounded"></div>
                            </div>
                          ))}
                        </div>
                      ) : timelineSteps ? (
                        <div className="space-y-4">
                          {timelineSteps.slice(0, 3).map((step, index) => (
                            <div key={index} className={`border-l-2 ${
                              step.type === 'initial' ? 'border-blue-300' : 
                              index === timelineSteps.length - 1 ? 'border-blue-400' : 'border-gray-200'
                            } pl-4`}>
                              <div className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {step.period}
                                {step.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span className="font-medium">{step.rating}</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-gray-700 text-sm">{step.content}</p>
                            </div>
                          ))}
                          {timelineSteps.length > 3 && (
                            <div className="text-sm text-blue-600 font-medium">
                              +{timelineSteps.length - 3} more updates
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500">No timeline updates available</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Circle Highlighted Review */}
          {circleHighlightedReviews.length > 0 && (
            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-blue-600 text-white">Circle Highlighted</Badge>
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-600 font-medium">Trending in your network</span>
                </div>
                <ReviewCard 
                  review={transformReviewForUI(circleHighlightedReviews[0])} 
                  onHelpfulClick={onHelpfulClick}
                />
              </CardContent>
            </Card>
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

        {/* You Might Also Consider */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>You Might Also Consider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  name: "HealthifyMe",
                  rating: 4.2,
                  category: "Health Apps",
                  image: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=100&h=100&fit=crop"
                },
                {
                  name: "MyFitnessPal",
                  rating: 4.0,
                  category: "Fitness Apps",
                  image: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=100&h=100&fit=crop"
                },
                {
                  name: "Optimum Nutrition",
                  rating: 4.5,
                  category: "Supplements",
                  image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop"
                }
              ].map((entity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                  <img src={entity.image} alt={entity.name} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1">
                    <h4 className="font-medium">{entity.name}</h4>
                    <p className="text-sm text-gray-500">{entity.category}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{entity.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
    </>
  );
};
