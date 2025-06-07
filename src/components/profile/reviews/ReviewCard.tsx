
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal, 
  Heart, 
  MessageSquare, 
  Save, 
  Share2, 
  Flag, 
  CheckCircle, 
  Star 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { deleteReview, toggleReviewLike, toggleReviewSave } from '@/services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';
import UsernameLink from '@/components/common/UsernameLink';
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { cn } from "@/lib/utils";
import { ProfileDisplay } from '@/components/common/ProfileDisplay';
import { TimelineIndicator } from './TimelineIndicator';
import { TimelineViewer } from './TimelineViewer';

interface ReviewCardProps {
  review: any;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onDeleted?: () => void;
  refreshReviews?: () => void;
  hideEntityFallbacks?: boolean;
  compact?: boolean;
  showTimelineIndicator?: boolean;
  onTimelineUpdate?: () => void;
}

const ReviewCard = ({ 
  review, 
  onLike, 
  onSave, 
  onDeleted, 
  refreshReviews,
  hideEntityFallbacks = false,
  compact = false,
  showTimelineIndicator = false,
  onTimelineUpdate
}: ReviewCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like reviews",
        variant: "destructive"
      });
      return;
    }
    
    if (onLike) {
      onLike(id);
    }
  };

  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save reviews",
        variant: "destructive"
      });
      return;
    }

    if (onSave) {
      onSave(id);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteReview(id);
      if (success) {
        toast({
          title: "Review deleted",
          description: "Your review has been successfully deleted",
        });
        
        if (onDeleted) {
          onDeleted();
        }
        if (refreshReviews) {
          refreshReviews();
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to delete review",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive"
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleTimelineToggle = () => {
    setTimelineExpanded(!timelineExpanded);
  };

  return (
    <Card className={cn("transition-all duration-200", compact ? "p-3" : "p-4")}>
      <CardContent className="p-0">
        <div className="flex gap-4">
          {review.entity?.image_url ? (
            <div className="w-24 h-20 rounded-md overflow-hidden relative">
              <ImageWithFallback
                src={review.entity.image_url}
                alt={review.entity.name}
                className="object-cover w-full h-full"
                fallbackSrc="/placeholder-image.png"
              />
            </div>
          ) : !hideEntityFallbacks ? (
            <div className="w-24 h-20 rounded-md overflow-hidden relative">
              <ImageWithFallback
                src="/placeholder-image.png"
                alt="Placeholder"
                className="object-cover w-full h-full"
                fallbackSrc="/placeholder-image.png"
              />
            </div>
          ) : null}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-semibold truncate", compact ? "text-base" : "text-lg")}>
                    {review.title}
                  </h3>
                  {showTimelineIndicator && (
                    <TimelineIndicator
                      hasTimeline={review.has_timeline || false}
                      timelineCount={review.timeline_count || 0}
                      trustScore={review.trust_score}
                      isRecommended={review.is_recommended}
                      size={compact ? 'sm' : 'md'}
                    />
                  )}
                </div>
                
                {review.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">
                    {review.subtitle}
                  </p>
                )}
                
                {review.venue && (
                  <p className="text-sm text-muted-foreground truncate">
                    {review.venue}
                  </p>
                )}
                
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {review.rating && (
                    <>
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <span>{review.rating}/5</span>
                    </>
                  )}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleLike(review.id)}>
                    Like
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSave(review.id)}>
                    Save
                  </DropdownMenuItem>
                  {user?.id === review.user_id && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="text-red-500 focus:bg-red-500 hover:bg-red-500"
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(review.title + ' - ' + review.description)}`} target="_blank" rel="noopener noreferrer">
                      Share on Twitter
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer">
                      Share on Facebook
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <a href={`https://www.linkedin.com/shareArticle?url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(review.title)}&summary=${encodeURIComponent(review.description)}`} target="_blank" rel="noopener noreferrer">
                      Share on LinkedIn
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <a href={`mailto:?subject=${encodeURIComponent(review.title)}&body=${encodeURIComponent(review.description + ' - ' + window.location.href)}`}>
                      Share via Email
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <a href={`https://twitter.com/intent/flag?text=${encodeURIComponent(review.title + ' - ' + review.description)}`} target="_blank" rel="noopener noreferrer">
                      Report
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {review.description}
            </p>
            
            {review.entity && !hideEntityFallbacks && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <ProfileDisplay 
                  userId={review.user_id}
                  size="sm"
                  showUsername={true}
                />
              </div>
            )}
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => handleLike(review.id)}>
                <Heart className="h-4 w-4" />
                <span>{review.likes || 0}</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
                <MessageSquare className="h-4 w-4" />
                <span>{review.comment_count || 0}</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => handleSave(review.id)}>
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
              <span className="ml-auto">{formatRelativeDate(review.created_at)}</span>
            </div>
            
            {showTimelineIndicator && (review.has_timeline || review.timeline_count > 0) && (
              <TimelineViewer
                reviewId={review.id}
                timelineCount={review.timeline_count || 0}
                isExpanded={timelineExpanded}
                onToggle={handleTimelineToggle}
              />
            )}
          </div>
        </div>
      </CardContent>
      
      <ConfirmDeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => handleDelete(review.id)}
        itemName="review"
      />
    </Card>
  );
};

export default ReviewCard;
