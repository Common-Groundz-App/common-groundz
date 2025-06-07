
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useReviews } from '@/hooks/use-reviews';
import ReviewCard from './reviews/ReviewCard';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ProfileDynamicReviewsProps = {
  profileUserId: string;
  isOwnProfile?: boolean;
};

const ProfileDynamicReviews = ({ profileUserId, isOwnProfile = false }: ProfileDynamicReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  console.log('ProfileDynamicReviews rendering with profileUserId:', profileUserId);
  
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
  
  // Filter reviews to show only those with timeline updates (has_timeline = true)
  const dynamicReviews = React.useMemo(() => {
    if (!reviews) return [];
    
    return reviews
      .filter(review => review.has_timeline === true)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [reviews]);
  
  // Debug log reviews when they change
  useEffect(() => {
    console.log('Dynamic Reviews in ProfileDynamicReviews:', dynamicReviews?.length || 0);
    if (dynamicReviews?.length) {
      console.log('First dynamic review:', dynamicReviews[0]);
    }
  }, [dynamicReviews]);

  const handleReviewDeleted = () => {
    refreshReviews();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
      <Card className="text-center py-12">
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <TrendingUp className="h-16 w-16 text-muted-foreground/50" />
              <Clock className="h-6 w-6 text-brand-orange absolute -top-1 -right-1" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              {isOwnProfile ? "No Timeline Reviews Yet" : "No Timeline Reviews"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isOwnProfile 
                ? "Timeline reviews are reviews with updates over time. When you update a review with new experiences, it becomes a dynamic timeline review."
                : "This user hasn't created any timeline reviews yet. Timeline reviews track experiences over time with updates."
              }
            </p>
          </div>
          {isOwnProfile && (
            <div className="flex flex-col items-center gap-3 mt-6">
              <Badge variant="outline" className="text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />
                Pro Tip
              </Badge>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create a review, then add updates to it later to track how your experience changes over time!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-orange" />
            <h2 className="text-lg font-semibold">Timeline Reviews</h2>
          </div>
          <Badge variant="secondary">
            {dynamicReviews.length} review{dynamicReviews.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
      
      {/* Dynamic Reviews List */}
      <div className="space-y-4">
        {dynamicReviews.map(review => (
          <div key={review.id} className="relative">
            <ReviewCard 
              review={review}
              onLike={handleLike}
              onSave={handleSave}
              onDeleted={handleReviewDeleted}
              showTimelineIndicator={true}
            />
            {/* Timeline indicator */}
            <div className="absolute top-4 right-4">
              <Badge variant="outline" className="text-xs bg-brand-orange/10 border-brand-orange/30">
                <Clock className="h-3 w-3 mr-1" />
                {review.timeline_count || 0} update{(review.timeline_count || 0) !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileDynamicReviews;
