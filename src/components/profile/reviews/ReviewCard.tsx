
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  Bookmark, 
  Share2, 
  MoreHorizontal, 
  MapPin, 
  Calendar,
  Clock,
  Eye,
  Brain,
  Loader
} from 'lucide-react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Review } from '@/services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';
import { ReviewTimelineViewer } from './ReviewTimelineViewer';
import { TimelinePreview } from './TimelinePreview';
import { TimelineBadge } from './TimelineBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useAISummaryGeneration } from '@/hooks/use-ai-summary-generation';

interface ReviewCardProps {
  review: Review;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onConvert?: (id: string) => void;
  refreshReviews: () => void;
  showTimelineFeatures?: boolean;
}

const ReviewCard = ({ 
  review, 
  onLike, 
  onSave, 
  onConvert, 
  refreshReviews,
  showTimelineFeatures = false 
}: ReviewCardProps) => {
  const { user } = useAuth();
  const { generateReviewSummary, isGenerating } = useAISummaryGeneration();
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const isAdmin = user?.email?.endsWith('@lovable.dev');
  const canShowAISummary = (review.timeline_count || 0) >= 2;
  const hasAISummary = Boolean(review.ai_summary);

  const handleGenerateAISummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await generateReviewSummary(review.id);
    if (success) {
      refreshReviews();
    }
  };

  const renderAISummaryPreview = () => {
    if (!canShowAISummary) return null;

    return (
      <div className="mt-3 pt-3 border-t border-muted/30">
        <div className="flex items-start gap-2">
          <Brain className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {hasAISummary ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-violet-900 dark:text-violet-100">
                    AI Timeline Insights
                  </span>
                  {review.ai_summary_model_used && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {review.ai_summary_model_used === 'gemini-1.5-flash' ? 'Gemini' : 'GPT'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {review.ai_summary}
                </p>
                {review.ai_summary_last_generated_at && (
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    Generated {formatRelativeDate(review.ai_summary_last_generated_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'AI summary available to generate' : 'AI insights pending'}
                </p>
                {isAdmin && (
                  <Button
                    onClick={handleGenerateAISummary}
                    disabled={isGenerating}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs gap-1"
                  >
                    {isGenerating && <Loader className="h-3 w-3 animate-spin" />}
                    Generate
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden">
        <CardContent className="p-0">
          {/* Image Section */}
          {review.image_url && (
            <div className="relative h-48 overflow-hidden">
              <img
                src={review.image_url}
                alt={review.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {/* Timeline Badge Overlay */}
              {review.has_timeline && (
                <div className="absolute top-3 left-3">
                  <TimelineBadge count={review.timeline_count || 0} />
                </div>
              )}
              {/* Rating Overlay */}
              <div className="absolute top-3 right-3">
                <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm">
                  <ConnectedRingsRating
                    value={review.rating}
                    variant="badge"
                    showValue={false}
                    size="sm"
                    minimal={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {review.title}
                </h3>
                {!review.image_url && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {review.has_timeline && (
                      <TimelineBadge count={review.timeline_count || 0} />
                    )}
                    <ConnectedRingsRating
                      value={review.rating}
                      variant="badge"
                      showValue={false}
                      size="sm"
                      minimal={true}
                    />
                  </div>
                )}
              </div>

              {/* Venue and Category */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {review.venue && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{review.venue}</span>
                  </div>
                )}
                <Badge variant="secondary" className="text-xs">
                  {review.category}
                </Badge>
              </div>
            </div>

            {/* Description */}
            {review.description && (
              <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {review.description}
              </p>
            )}

            {/* Timeline Preview */}
            {review.has_timeline && review.timeline_count && review.timeline_count > 0 && (
              <TimelinePreview 
                timelineCount={review.timeline_count}
                initialRating={review.rating}
                onViewTimeline={() => setIsTimelineOpen(true)}
              />
            )}

            {/* AI Summary Preview */}
            {renderAISummaryPreview()}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-muted/30">
              {/* Metadata */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatRelativeDate(review.created_at)}</span>
                </div>
                {review.experience_date && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Experienced {new Date(review.experience_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLike(review.id);
                  }}
                  className={`h-8 px-2 gap-1 ${review.isLiked ? 'text-red-500' : ''}`}
                >
                  <Heart className={`h-3 w-3 ${review.isLiked ? 'fill-current' : ''}`} />
                  <span className="text-xs">{review.likes || 0}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave(review.id);
                  }}
                  className={`h-8 px-2 ${review.isSaved ? 'text-primary' : ''}`}
                >
                  <Bookmark className={`h-3 w-3 ${review.isSaved ? 'fill-current' : ''}`} />
                </Button>

                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Share2 className="h-3 w-3" />
                </Button>

                {onConvert && !review.is_converted && (
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Modal */}
      {showTimelineFeatures && (
        <ReviewTimelineViewer
          isOpen={isTimelineOpen}
          onClose={() => setIsTimelineOpen(false)}
          reviewId={review.id}
          reviewOwnerId={review.user_id}
          reviewTitle={review.title}
          initialRating={review.rating}
          onTimelineUpdate={refreshReviews}
          aiSummary={review.ai_summary}
          aiSummaryLastGenerated={review.ai_summary_last_generated_at}
          aiSummaryModel={review.ai_summary_model_used}
          timelineCount={review.timeline_count}
        />
      )}
    </>
  );
};

export default ReviewCard;
