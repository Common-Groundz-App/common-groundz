import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, User, Sparkles, AlertCircle } from 'lucide-react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchReviewUpdates, addReviewUpdate, fetchReviewWithSummary, type ReviewUpdate, type Review } from '@/services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AISummaryCard } from '@/components/ui/ai-summary-card';
import { getSentimentColor } from '@/utils/ratingColorUtils';

interface ReviewTimelineViewerProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  reviewOwnerId: string;
  reviewTitle: string;
  initialRating: number;
  onTimelineUpdate?: () => void;
}

export const ReviewTimelineViewer = ({
  isOpen,
  onClose,
  reviewId,
  reviewOwnerId,
  reviewTitle,
  initialRating,
  onTimelineUpdate
}: ReviewTimelineViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timelineUpdates, setTimelineUpdates] = useState<ReviewUpdate[]>([]);
  const [reviewData, setReviewData] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.id === reviewOwnerId;

  useEffect(() => {
    if (isOpen) {
      loadTimelineData();
    }
  }, [isOpen, reviewId]);

  const loadTimelineData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Loading timeline data for review:', reviewId);
      
      // Load both timeline updates and complete review data
      const [updates, review] = await Promise.all([
        fetchReviewUpdates(reviewId),
        fetchReviewWithSummary(reviewId)
      ]);
      
      console.log('📋 Timeline updates loaded:', updates?.length || 0);
      console.log('📊 Review data loaded:', {
        id: review?.id,
        hasAiSummary: !!review?.ai_summary,
        aiSummaryLength: review?.ai_summary?.length || 0,
        timelineCount: review?.timeline_count,
        hasTimeline: review?.has_timeline
      });
      
      setTimelineUpdates(updates);
      setReviewData(review);
    } catch (error) {
      console.error('❌ Error loading timeline data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load timeline data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!user || !newComment.trim()) {
      toast({
        title: 'Error',
        description: 'Please add a comment for your update',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await addReviewUpdate(reviewId, user.id, newRating, newComment.trim());
      
      if (success) {
        toast({
          title: 'Update added',
          description: 'Your timeline update has been added successfully'
        });
        
        // Reset form
        setNewRating(null);
        setNewComment('');
        setIsAddingUpdate(false);
        
        // Reload timeline data
        await loadTimelineData();
        
        // Notify parent component to refresh data
        if (onTimelineUpdate) {
          onTimelineUpdate();
        }
      } else {
        throw new Error('Failed to add update');
      }
    } catch (error) {
      console.error('Error adding timeline update:', error);
      toast({
        title: 'Error',
        description: 'Failed to add timeline update',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  // Enhanced conditional check with detailed logging
  const shouldShowAISummary = () => {
    const hasReviewData = !!reviewData;
    const hasAiSummary = !!(reviewData?.ai_summary && reviewData.ai_summary.trim().length > 0);
    const hasValidTimelineCount = typeof reviewData?.timeline_count === 'number' && reviewData.timeline_count >= 1;
    const hasTimeline = !!reviewData?.has_timeline;

    console.log('🤔 AI Summary Display Check:', {
      hasReviewData,
      hasAiSummary,
      aiSummaryLength: reviewData?.ai_summary?.length || 0,
      hasValidTimelineCount,
      timelineCount: reviewData?.timeline_count,
      hasTimeline,
      shouldShow: hasReviewData && hasAiSummary && hasValidTimelineCount
    });

    return hasReviewData && hasAiSummary && hasValidTimelineCount;
  };

  const showAISummary = shouldShowAISummary();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Timeline for "{reviewTitle}"
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* AI Summary Section - Now using reusable component */}
              {showAISummary && (
                <AISummaryCard summary={reviewData.ai_summary} />
              )}

              {/* Show message when AI summary should appear but doesn't */}
              {!showAISummary && reviewData && reviewData.timeline_count && reviewData.timeline_count >= 1 && (
                <Card className="bg-gray-50 border-gray-200">
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      AI summary is being generated for this timeline...
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Initial Review Entry - Enhanced with user info */}
              <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={reviewData?.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(reviewData?.user?.username || null)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">
                        {reviewData?.user?.username || 'User'}
                      </span>
                      <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                        Initial Review
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {reviewData && formatRelativeDate(reviewData.created_at)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <ConnectedRingsRating
                        value={initialRating}
                        variant="badge"
                        showValue={false}
                        size="sm"
                        minimal={true}
                      />
                      <span 
                        className="font-medium"
                        style={{ color: getSentimentColor(initialRating) }}
                      >
                        {initialRating.toFixed(1)}
                      </span>
                    </div>
                    
                    {reviewData?.description && (
                      <p className="text-sm text-muted-foreground">
                        {reviewData.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline Updates */}
              {timelineUpdates.map((update, index) => (
                <div key={update.id} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={update.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(update.profiles?.username || null)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">
                          {update.profiles?.username || 'User'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Update #{timelineUpdates.length - index}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatRelativeDate(update.created_at)}
                        </div>
                      </div>
                      
                      {update.rating && (
                        <div className="flex items-center gap-2 mb-2">
                          <ConnectedRingsRating
                            value={update.rating}
                            variant="badge"
                            showValue={false}
                            size="sm"
                            minimal={true}
                          />
                          <span 
                            className="font-medium"
                            style={{ color: getSentimentColor(update.rating) }}
                          >
                            {update.rating.toFixed(1)}
                          </span>
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground">
                        {update.comment}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {timelineUpdates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No timeline updates yet.</p>
                  {isOwner && (
                    <p className="text-sm mt-1">Be the first to add an update!</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Update Section for Review Owner */}
        {isOwner && (
          <div className="border-t pt-4 mt-4">
            {!isAddingUpdate ? (
              <Button
                onClick={() => setIsAddingUpdate(true)}
                className="w-full gap-2"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add Timeline Update
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Rating (optional)</label>
                  <div className="flex items-center gap-3">
                    <ConnectedRingsRating
                      value={newRating || 0}
                      onChange={setNewRating}
                      variant="default"
                      size="md"
                      showValue={false}
                      isInteractive={true}
                    />
                    {newRating && (
                      <span 
                        className="font-medium"
                        style={{ color: getSentimentColor(newRating) }}
                      >
                        {newRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Update Comment *</label>
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share what's changed in your experience..."
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddUpdate}
                    disabled={isSubmitting || !newComment.trim()}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Update'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingUpdate(false);
                      setNewRating(null);
                      setNewComment('');
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
