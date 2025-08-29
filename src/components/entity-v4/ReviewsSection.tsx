import React, { useState } from 'react';
import { MessageCircle, Camera, Eye, Star, Users, Search, ChevronDown, X } from "lucide-react";
import { RatingRingIcon } from "@/components/ui/rating-ring-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
  const [sortBy, setSortBy] = useState<'mostRecent' | 'highestRated' | 'lowestRated'>('mostRecent');
  const [activeFilters, setActiveFilters] = useState({
    verified: false,
    starRating: null as number | null,
    starFilter: 'range' as 'exact' | 'range',
    networkOnly: false,
    hasTimeline: false,
    hasMedia: false
  });
  const [selectedTimelineReview, setSelectedTimelineReview] = useState<ReviewWithUser | null>(null);
  const [isTimelineViewerOpen, setIsTimelineViewerOpen] = useState(false);

  const isAuthenticated = !!user && !authLoading;
  const hasCircleData = isAuthenticated && !circleLoading && circleUserIds.length > 0;

  const filteredReviews = filterReviews(reviews, {
    search: searchQuery || undefined,
    verified: activeFilters.verified || undefined,
    rating: activeFilters.starRating || undefined,
    starFilter: activeFilters.starFilter,
    networkOnly: activeFilters.networkOnly || undefined,
    hasTimeline: activeFilters.hasTimeline || undefined,
    hasMedia: activeFilters.hasMedia || undefined,
    sortBy: sortBy
  }, circleUserIds);

  const bypassPrioritySystem = sortBy === 'highestRated' || sortBy === 'lowestRated';
  
  const timelineReviews = getTimelineReviews(filteredReviews);
  const allCircleReviews = hasCircleData ? 
    filteredReviews.filter(review => circleUserIds.includes(review.user_id)) : [];
  
  let hybridReviews: ReviewWithUser[] = [];
  let circleOnlyReviews: ReviewWithUser[] = [];
  let timelineOnlyReviews: ReviewWithUser[] = [];
  let regularReviews: ReviewWithUser[] = [];
  let displayReviews: ReviewWithUser[];
  
  if (bypassPrioritySystem) {
    displayReviews = filteredReviews;
    
    hybridReviews = timelineReviews.filter(review => 
      allCircleReviews.some(cr => cr.id === review.id)
    );
    
    circleOnlyReviews = allCircleReviews.filter(review => 
      !timelineReviews.some(tr => tr.id === review.id)
    );
    
    timelineOnlyReviews = timelineReviews.filter(review => 
      !allCircleReviews.some(cr => cr.id === review.id)
    );
    
    const hybridReviewIds = new Set(hybridReviews.map(r => r.id));
    const circleOnlyReviewIds = new Set(circleOnlyReviews.map(r => r.id));
    const timelineOnlyReviewIds = new Set(timelineOnlyReviews.map(r => r.id));
    
    regularReviews = filteredReviews.filter(review => 
      !hybridReviewIds.has(review.id) && 
      !circleOnlyReviewIds.has(review.id) && 
      !timelineOnlyReviewIds.has(review.id)
    );
  } else {
    hybridReviews = timelineReviews.filter(review => 
      allCircleReviews.some(cr => cr.id === review.id)
    );
    
    circleOnlyReviews = allCircleReviews.filter(review => 
      !timelineReviews.some(tr => tr.id === review.id)
    );
    
    timelineOnlyReviews = timelineReviews.filter(review => 
      !allCircleReviews.some(cr => cr.id === review.id)
    );
    
    const hybridReviewIds = new Set(hybridReviews.map(r => r.id));
    const circleOnlyReviewIds = new Set(circleOnlyReviews.map(r => r.id));
    const timelineOnlyReviewIds = new Set(timelineOnlyReviews.map(r => r.id));
    
    regularReviews = filteredReviews.filter(review => 
      !hybridReviewIds.has(review.id) && 
      !circleOnlyReviewIds.has(review.id) && 
      !timelineOnlyReviewIds.has(review.id)
    );
    
    displayReviews = [...hybridReviews, ...circleOnlyReviews, ...timelineOnlyReviews, ...regularReviews];
  }

  const transformedRegularReviews = regularReviews.slice(0, 3).map(transformReviewForUI);

  const toggleFilter = (filter: keyof typeof activeFilters) => {
    if (filter === 'starRating') return;
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  const setStarRating = (rating: number | null, filterType: 'exact' | 'range' = 'range') => {
    setActiveFilters(prev => ({
      ...prev,
      starRating: rating,
      starFilter: filterType
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

  const getSortButtonText = () => {
    switch(sortBy) {
      case 'mostRecent': return 'Most Recent';
      case 'highestRated': return 'Highest Rated';
      case 'lowestRated': return 'Lowest Rated';
      default: return 'Sort';
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (activeFilters.verified) count++;
    if (activeFilters.starRating !== null) count++;
    if (activeFilters.networkOnly) count++;
    if (activeFilters.hasTimeline) count++;
    if (activeFilters.hasMedia) count++;
    return count;
  };

  const getFilterButtonText = () => {
    const count = getActiveFiltersCount();
    if (count === 0) return 'Filter';
    return `Filter (${count})`;
  };

  const hasActiveFilters = () => {
    return getActiveFiltersCount() > 0 || searchQuery.trim() !== '';
  };

  const clearAllFilters = () => {
    setActiveFilters({
      verified: false,
      starRating: null,
      starFilter: 'range',
      networkOnly: false,
      hasTimeline: false,
      hasMedia: false
    });
    setSearchQuery('');
    setSortBy('mostRecent');
  };

  const getTotalResultsCount = () => {
    return displayReviews.length;
  };

  return (
    <>
      <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6 relative">
          <Badge 
            className="absolute top-0 right-0 -mt-2 -mr-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium px-2 py-0.5 rounded-full shadow-sm border-0 hover:from-blue-600 hover:to-cyan-600"
          >
            Coming Soon
          </Badge>
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

      <div className="mb-8" data-section="reviews">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900" id="reviews-section">Reviews & Social Proof</h2>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-4">
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
            
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-sm font-medium">
                    {getSortButtonText()}
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50 min-w-[160px]">
                  <DropdownMenuItem 
                    onClick={() => setSortBy('mostRecent')}
                    className={sortBy === 'mostRecent' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {sortBy === 'mostRecent' && <span className="mr-2">✓</span>}
                    Most Recent
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortBy('highestRated')}
                    className={sortBy === 'highestRated' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {sortBy === 'highestRated' && <span className="mr-2">✓</span>}
                    Highest Rated
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSortBy('lowestRated')}
                    className={sortBy === 'lowestRated' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {sortBy === 'lowestRated' && <span className="mr-2">✓</span>}
                    Lowest Rated
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={`text-sm font-medium ${getActiveFiltersCount() > 0 ? 'bg-blue-50 text-blue-700 border-blue-300' : ''}`}>
                    {getFilterButtonText()}
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50 min-w-[200px]">
                  <DropdownMenuItem 
                    onClick={() => toggleFilter('verified')}
                    className={activeFilters.verified ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.verified && <span className="mr-2">✓</span>}
                    Verified Only
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={() => setStarRating(5, 'exact')}
                    className={activeFilters.starRating === 5 && activeFilters.starFilter === 'exact' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.starRating === 5 && activeFilters.starFilter === 'exact' && <span className="mr-2">✓</span>}
                    <RatingRingIcon rating={5} size={12} className="mr-1" />
                    5 Rings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setStarRating(4, 'range')}
                    className={activeFilters.starRating === 4 && activeFilters.starFilter === 'range' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.starRating === 4 && activeFilters.starFilter === 'range' && <span className="mr-2">✓</span>}
                    <RatingRingIcon rating={4} size={12} className="mr-1" />
                    4+ Rings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setStarRating(3, 'range')}
                    className={activeFilters.starRating === 3 && activeFilters.starFilter === 'range' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.starRating === 3 && activeFilters.starFilter === 'range' && <span className="mr-2">✓</span>}
                    <RatingRingIcon rating={3} size={12} className="mr-1" />
                    3+ Rings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setStarRating(1, 'exact')}
                    className={activeFilters.starRating === 1 && activeFilters.starFilter === 'exact' ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.starRating === 1 && activeFilters.starFilter === 'exact' && <span className="mr-2">✓</span>}
                    <RatingRingIcon rating={1} size={12} className="mr-1" />
                    1 Ring
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem 
                    onClick={() => toggleFilter('hasTimeline')}
                    className={activeFilters.hasTimeline ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.hasTimeline && <span className="mr-2">✓</span>}
                    Has Timeline Updates
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => toggleFilter('hasMedia')}
                    className={activeFilters.hasMedia ? "bg-blue-50 text-blue-700" : ""}
                  >
                    {activeFilters.hasMedia && <span className="mr-2">✓</span>}
                    <Camera className="w-3 h-3 mr-1" />
                    Photos & Videos
                  </DropdownMenuItem>

                  {hasCircleData && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => toggleFilter('networkOnly')}
                        className={activeFilters.networkOnly ? "bg-blue-50 text-blue-700" : ""}
                      >
                        {activeFilters.networkOnly && <span className="mr-2">✓</span>}
                        <Users className="w-3 h-3 mr-1" />
                        My Circle ({circleUserIds.length})
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasActiveFilters() && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {getTotalResultsCount()} review{getTotalResultsCount() !== 1 ? 's' : ''}
              {(searchQuery || getActiveFiltersCount() > 0) && ' with current filters'}
            </span>
            
            {(searchQuery || getActiveFiltersCount() > 0) && (
              <div className="flex items-center gap-2 flex-wrap">
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs">
                    Search: "{searchQuery}"
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {activeFilters.verified && (
                  <Badge variant="secondary" className="text-xs">
                    Verified
                    <button 
                      onClick={() => toggleFilter('verified')}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {activeFilters.starRating && (
                  <Badge variant="secondary" className="text-xs">
                    {activeFilters.starFilter === 'exact' ? `${activeFilters.starRating} Rings` : `${activeFilters.starRating}+ Rings`}
                    <button 
                      onClick={() => setStarRating(null)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {activeFilters.hasTimeline && (
                  <Badge variant="secondary" className="text-xs">
                    Timeline Updates
                    <button 
                      onClick={() => toggleFilter('hasTimeline')}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {activeFilters.hasMedia && (
                  <Badge variant="secondary" className="text-xs">
                    Photos & Videos
                    <button 
                      onClick={() => toggleFilter('hasMedia')}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {activeFilters.networkOnly && (
                  <Badge variant="secondary" className="text-xs">
                    My Circle
                    <button 
                      onClick={() => toggleFilter('networkOnly')}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {hybridReviews.map(review => (
            <TimelineReviewCard
              key={review.id}
              review={review}
              onTimelineClick={handleTimelineClick}
              isCircleReview={true}
              circleUserName={review.user.username}
            />
          ))}

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

          {timelineOnlyReviews.map(review => (
            <TimelineReviewCard
              key={review.id}
              review={review}
              onTimelineClick={handleTimelineClick}
              isCircleReview={false}
              circleUserName={review.user.username}
            />
          ))}

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
